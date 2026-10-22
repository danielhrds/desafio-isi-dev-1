import { expect, test, type Page } from '@playwright/test';
import type { ClubDetail, ClubLineup } from '../../src/types/club';
import type { ClubTransactionsResponse } from '../../src/types/transaction';

const club: ClubDetail = {
  id: 1,
  name: 'Águias do Recife',
  acronym: 'ADR',
  cash: 184.71,
  squad_value: 734.22,
  net_worth: 918.93,
  players: [
    {
      id: 7,
      name: 'Bia Nogueira',
      position: 'MEI',
      overall: 82,
      agility: 80,
      age: 24,
      condition: 'APTO',
      base_value: 45,
      market_value: 47.8,
      club_id: 1,
      pace: 79,
      shooting: 72,
      passing: 87,
      dribbling: 83,
      defending: 61,
      physical: 70,
      potential: 91,
      contract: {
        purchase_value: 44.2,
        loyalty_until: '2027-03-02T10:15:00-03:00',
        remaining_days: 1095,
        penalty_rate: 20,
      },
    },
  ],
};

const lineup: ClubLineup = {
  club_id: club.id,
  formation: null,
  complete: false,
  players: [],
};

const transactions: ClubTransactionsResponse = {
  data: [
    {
      id: 19,
      club_id: club.id,
      player_id: 7,
      player_name: 'Bia Nogueira',
      type: 'COMPRA',
      value: 44.2,
      fee: 2.21,
      penalty: 0,
      profit: null,
      cash_change: -46.41,
      created_at: '2026-09-18T16:30:00-03:00',
    },
  ],
  summary: {
    total_spent: 46.41,
    total_received: 0,
    total_fees: 2.21,
    total_penalties: 0,
    total_profit: 0,
  },
};

async function mockClubApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/players')) {
      await route.fulfill({
        json: {
          data: [],
          meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
        },
      });
      return;
    }
    if (url.pathname === '/api/v1/clubs') {
      await route.fulfill({
        json: [
          {
            id: club.id,
            name: club.name,
            acronym: club.acronym,
            cash: club.cash,
            squad_value: club.squad_value,
            net_worth: club.net_worth,
          },
        ],
      });
      return;
    }
    if (url.pathname === `/api/v1/clubs/${club.id}`) {
      await route.fulfill({ json: club });
      return;
    }
    if (url.pathname === `/api/v1/clubs/${club.id}/lineup`) {
      await route.fulfill({ json: lineup });
      return;
    }
    if (url.pathname === `/api/v1/clubs/${club.id}/transactions`) {
      await route.fulfill({ json: transactions });
      return;
    }

    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route' },
    });
  });
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollX: window.scrollX,
    })),
  ).toEqual({
    documentWidth: 375,
    bodyWidth: 375,
    viewportWidth: 375,
    scrollX: 0,
  });
}

test('F5 club list and create dialog remain usable at 375px with internal table scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockClubApi(page);
  await page.goto('/clubes');

  await expect(page.getByRole('heading', { name: 'Clubes' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Clubes' });
  await expect(table).toBeVisible();
  await expectNoPageOverflow(page);

  const tableContainer = page
    .locator('[data-slot="table-container"]')
    .filter({ has: table });
  const tableSize = await tableContainer.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(tableSize.width).toBeLessThanOrEqual(375);
  expect(tableSize.scrollWidth).toBeGreaterThan(tableSize.width);
  expect(tableSize.overflowX).toMatch(/auto|scroll/);

  await page.getByRole('button', { name: 'Novo clube' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo clube' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('textbox', { name: 'Nome' })).toBeEnabled();
  await expect(dialog.getByRole('textbox', { name: 'Sigla' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  await expect(
    dialog.getByRole('button', { name: 'Criar clube' }),
  ).toBeEnabled();
  await expectNoPageOverflow(page);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
});

test('F5 club history controls and wide transaction table remain usable at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockClubApi(page);
  await page.goto(`/clubes/${club.id}`);

  await expect(page.getByRole('heading', { name: club.name })).toBeVisible();
  await page.getByRole('tab', { name: 'Histórico' }).click();

  const historyRegion = page.getByRole('region', {
    name: 'Tabela e resumo do histórico de transações',
  });
  await expect(historyRegion).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Filtrar por compra' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Filtrar por venda' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('combobox', { name: 'Filtrar por jogador' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Exportar CSV' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('table', { name: 'Histórico de transações do clube' }),
  ).toBeVisible();

  const regionSize = await historyRegion.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(regionSize.width).toBeLessThanOrEqual(375);
  expect(regionSize.scrollWidth).toBeGreaterThan(regionSize.width);
  expect(regionSize.overflowX).toMatch(/auto|scroll/);
  await historyRegion.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await historyRegion.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  await expectNoPageOverflow(page);
});
