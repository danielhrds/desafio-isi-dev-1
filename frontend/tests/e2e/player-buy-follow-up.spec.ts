import { expect, test, type Page } from '@playwright/test';
import type { ClubDetail, ClubLineup, ClubSummary } from '../../src/types/club';
import type { ClubTransactionsResponse } from '../../src/types/transaction';
import type { BuyPlayerResult } from '../../src/types/market';
import type { PlayerListItem } from '../../src/types/player';

const player: PlayerListItem = {
  id: 15,
  name: 'Meia Lua',
  position: 'MEI',
  age: 26,
  agility: 76,
  condition: 'APTO',
  club_id: null,
  overall: 78,
  base_value: 70,
  market_value: 76,
};

const club: ClubSummary = {
  id: 3,
  name: 'Real Madrid CF',
  acronym: 'RMC',
  cash: 300,
  squad_value: 0,
  net_worth: 300,
};

const initialClub: ClubDetail = {
  ...club,
  players: [],
};

const purchasedRosterPlayer = {
  ...player,
  club_id: club.id,
  pace: 64,
  shooting: 70,
  passing: 82,
  dribbling: 77,
  defending: 55,
  physical: 71,
  potential: 90,
  contract: {
    purchase_value: 76,
    loyalty_until: '2027-03-20T10:15:00-03:00',
    remaining_days: 149,
    penalty_rate: 10,
  },
};

const purchasedClub: ClubDetail = {
  ...club,
  cash: 220.2,
  squad_value: 76,
  net_worth: 296.2,
  players: [purchasedRosterPlayer],
};

const purchaseResult: BuyPlayerResult = {
  id: 42,
  club_id: club.id,
  player_id: player.id,
  player_name: player.name,
  type: 'COMPRA',
  value: 76,
  fee: 3.8,
  penalty: 0,
  profit: null,
  cash_change: -79.8,
  created_at: '2026-10-22T15:00:00-03:00',
  contract: {
    purchase_value: 76,
    loyalty_until: '2027-03-20T10:15:00-03:00',
    status: 'ATIVO',
  },
  club_cash: 220.2,
};

const emptyLineup: ClubLineup = {
  club_id: club.id,
  formation: null,
  complete: false,
  players: [],
};

const emptyTransactions: ClubTransactionsResponse = {
  data: [],
  summary: {
    total_spent: 0,
    total_received: 0,
    total_fees: 0,
    total_penalties: 0,
    total_profit: 0,
  },
};

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

async function mockApi(page: Page) {
  let purchased = false;
  const purchaseRequests: Array<{ url: string; body: unknown }> = [];
  const playerRequests: URLSearchParams[] = [];
  const clubDetailReads: Array<{
    purchased: boolean;
    response: ClubDetail;
  }> = [];
  const documentRequests: string[] = [];
  const unexpected: string[] = [];

  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests.push(request.url());
    }
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === 'POST' &&
      url.pathname === `/api/v1/players/${player.id}/buy`
    ) {
      purchaseRequests.push({
        url: url.pathname,
        body: request.postDataJSON(),
      });
      purchased = true;
      await route.fulfill({ status: 200, json: purchaseResult });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      const params = new URLSearchParams(url.searchParams);
      playerRequests.push(params);

      const free = params.get('free');
      const clubId = params.get('club_id');
      const matches =
        clubId !== null
          ? purchased && clubId === String(club.id)
          : free === 'true'
            ? !purchased
            : free === 'false'
              ? purchased
              : true;
      const total = Number(matches);
      const limit = Number(params.get('limit') ?? 10);
      const item = purchased ? { ...player, club_id: club.id } : player;

      await route.fulfill({
        json: {
          data: matches ? [item].slice(0, limit) : [],
          meta: {
            page: Number(params.get('page') ?? 1),
            limit,
            total_items: total,
            total_pages: total,
          },
        },
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({
        json: [purchased ? purchasedClub : initialClub],
      });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}`
    ) {
      const response = purchased ? purchasedClub : initialClub;
      clubDetailReads.push({ purchased, response });
      await route.fulfill({ json: response });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}/lineup`
    ) {
      await route.fulfill({ json: emptyLineup });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}/transactions`
    ) {
      await route.fulfill({ json: emptyTransactions });
      return;
    }

    unexpected.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 404, json: { message: 'Rota inesperada.' } });
  });

  return {
    purchaseRequests,
    playerRequests,
    clubDetailReads,
    documentRequests,
    unexpected,
  };
}

async function expectNoHorizontalPageOverflow(page: Page, width: number) {
  expect(
    await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollX: window.scrollX,
    })),
  ).toEqual({
    documentWidth: width,
    bodyWidth: width,
    viewportWidth: width,
    scrollX: 0,
  });
}

async function expectTableScrollInsideContainer(page: Page, tableName: string) {
  const table = page.getByRole('table', { name: tableName, exact: true });
  const container = page
    .locator('[data-slot="table-container"]')
    .filter({ has: table });
  const dimensions = await container.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(dimensions.width).toBeLessThanOrEqual(375);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
  expect(dimensions.overflowX).toMatch(/auto|scroll/);
}

async function openBuyDialog(page: Page) {
  const row = page.getByRole('row').filter({ hasText: player.name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Comprar', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function completePurchase(page: Page) {
  const dialog = await openBuyDialog(page);
  await dialog.getByRole('combobox', { name: 'Clube comprador' }).click();
  await page
    .getByRole('option', {
      name: 'Real Madrid CF (RMC) · caixa 300,00',
    })
    .click();
  await dialog.locator('#buy-loyalty-date').fill('2027-03-20');
  await dialog.locator('#buy-loyalty-time').fill('10:15');
  await dialog.getByRole('button', { name: 'Confirmar compra' }).click();

  const success = page.getByRole('dialog', { name: 'Compra concluída' });
  await expect(success).toBeVisible();
  await expect(
    success.getByText('Meia Lua agora é do Real Madrid CF.'),
  ).toBeVisible();
  return success;
}

async function navigateToPlayers(page: Page, viewportWidth: number) {
  if (viewportWidth === 375) {
    await page.getByRole('button', { name: 'Alternar menu' }).click();
    const sidebar = page.getByRole('dialog', { name: 'Sidebar', exact: true });
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('link', { name: 'Jogadores' }).click();
  } else {
    await page.getByRole('link', { name: 'Jogadores', exact: true }).click();
  }

  await expect(page.getByRole('heading', { name: 'Jogadores' })).toBeVisible();
}

for (const viewport of viewports) {
  test(`F06/F07 refreshes club data and player filters after a purchase at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page);

    await page.goto(`/clubes/${club.id}`);
    await expect(
      page.getByRole('heading', { name: club.name, exact: true }),
    ).toBeVisible();
    const initialSummary = page.getByRole('region', {
      name: 'Resumo financeiro e do elenco',
    });
    await expect(initialSummary).toContainText('300,00');
    await expect(
      page.getByText('O clube ainda não tem jogadores'),
    ).toBeVisible();
    expect(api.clubDetailReads[0]).toEqual({
      purchased: false,
      response: initialClub,
    });
    await expectNoHorizontalPageOverflow(page, viewport.width);

    await navigateToPlayers(page, viewport.width);
    await expectNoHorizontalPageOverflow(page, viewport.width);
    const success = await completePurchase(page);
    expect(api.purchaseRequests).toEqual([
      {
        url: `/api/v1/players/${player.id}/buy`,
        body: {
          club_id: club.id,
          loyalty_until: '2027-03-20T10:15-03:00',
        },
      },
    ]);

    await success.getByRole('link', { name: 'Ver clube' }).click();
    await expect(
      page.getByRole('heading', { name: club.name, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(`/clubes/${club.id}`);

    const updatedSummary = page.getByRole('region', {
      name: 'Resumo financeiro e do elenco',
    });
    await expect(updatedSummary).toContainText('220,20');
    await expect(updatedSummary).toContainText('76,00');
    await expect(updatedSummary).toContainText('296,20');
    await expect(
      updatedSummary.getByText('1 de 12', { exact: true }),
    ).toBeVisible();

    const roster = page.getByRole('table', { name: 'Elenco do clube' });
    const rosterRow = roster.getByRole('row').filter({ hasText: player.name });
    await expect(rosterRow).toBeVisible();
    await expect(rosterRow.getByText('76,00', { exact: true })).toHaveCount(2);
    await expect(
      rosterRow.getByText('20/03/2027', { exact: true }),
    ).toBeVisible();
    await expect(rosterRow.getByText('10:15', { exact: true })).toBeVisible();
    await expect(rosterRow.getByText('149', { exact: true })).toBeVisible();
    await expect(rosterRow.getByText('10%', { exact: true })).toBeVisible();
    expect(
      api.clubDetailReads.some(
        (read) =>
          read.purchased &&
          read.response.cash === purchasedClub.cash &&
          read.response.squad_value === purchasedClub.squad_value &&
          read.response.net_worth === purchasedClub.net_worth &&
          read.response.players[0]?.contract.remaining_days === 149,
      ),
    ).toBe(true);

    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page, viewport.width);
      await expectTableScrollInsideContainer(page, 'Elenco do clube');
    }

    await navigateToPlayers(page, viewport.width);
    const playerTable = page.getByRole('table', {
      name: 'Jogadores',
      exact: true,
    });
    const clubFilter = page.getByRole('combobox', {
      name: 'Clube',
      exact: true,
    });
    await clubFilter.click();
    await page.getByRole('option', { name: club.name, exact: true }).click();

    const purchasedRow = playerTable
      .getByRole('row')
      .filter({ hasText: player.name });
    await expect(purchasedRow).toBeVisible();
    await expect(purchasedRow).toContainText(club.acronym);
    await expect(clubFilter).toHaveText(club.name);
    await expect(page.getByRole('tab', { name: /^Livres/ })).toBeDisabled();
    expect(
      api.playerRequests.some(
        (params) =>
          params.get('club_id') === String(club.id) &&
          !params.has('free') &&
          params.get('limit') === '10',
      ),
    ).toBe(true);
    await expectNoHorizontalPageOverflow(page, viewport.width);

    if (viewport.width === 375) {
      await expectTableScrollInsideContainer(page, 'Jogadores');
    }

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(clubFilter).toHaveText('Clube');
    const freeTab = page.getByRole('tab', { name: /^Livres/ });
    await expect(freeTab).toBeEnabled();
    await freeTab.click();
    await expect(purchasedRow).toHaveCount(0);
    expect(
      api.playerRequests.some(
        (params) =>
          params.get('free') === 'true' &&
          !params.has('club_id') &&
          params.get('limit') === '10',
      ),
    ).toBe(true);
    expect(
      api.playerRequests.some(
        (params) => params.get('free') === 'true' && params.has('club_id'),
      ),
    ).toBe(false);
    expect(api.documentRequests).toHaveLength(1);
    expect(api.unexpected).toEqual([]);
    await expectNoHorizontalPageOverflow(page, viewport.width);
  });
}
