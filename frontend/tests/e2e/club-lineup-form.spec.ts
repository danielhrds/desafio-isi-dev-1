import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  ClubDetail,
  ClubLineup,
  ClubRosterPlayer,
  ClubSummary,
} from '../../src/types/club';
import type { PlayerDetail } from '../../src/types/player';
import type { ClubTransactionsResponse } from '../../src/types/transaction';

const clubId = 1;
const clubName = 'Aurora FC';

function makePlayer(
  id: number,
  name: string,
  position: PlayerDetail['position'],
  condition: PlayerDetail['condition'] = 'APTO',
): PlayerDetail {
  return {
    id,
    name,
    position,
    overall: 70 + id,
    agility: 70,
    age: 24,
    condition,
    base_value: 25,
    market_value: 30,
    club_id: clubId,
    pace: 70,
    shooting: 70,
    passing: 70,
    dribbling: 70,
    defending: 70,
    physical: 70,
    potential: 80,
  };
}

const playerDetails: PlayerDetail[] = [
  makePlayer(1, 'Goleiro Ativo', 'GOL'),
  makePlayer(2, 'Zagueiro Um', 'ZAG'),
  makePlayer(3, 'Lateral Um', 'LAT'),
  makePlayer(4, 'Zagueiro Dois', 'ZAG'),
  makePlayer(5, 'Lateral Dois', 'LAT'),
  makePlayer(6, 'Zagueiro Doente', 'ZAG', 'DOENTE'),
  makePlayer(7, 'Meia Apto', 'MEI'),
  makePlayer(8, 'Meia Condicionado', 'MEI', 'MAL_CONDICIONADO'),
  makePlayer(9, 'Meia Doente', 'MEI', 'DOENTE'),
  makePlayer(10, 'Atacante Ativo', 'ATA'),
  makePlayer(11, 'Atacante Condicionado', 'ATA', 'MAL_CONDICIONADO'),
  makePlayer(12, 'Atacante Doente', 'ATA', 'DOENTE'),
];

const roster: ClubRosterPlayer[] = playerDetails.map((player) => ({
  ...player,
  contract: {
    purchase_value: 25,
    loyalty_until: '2027-03-02T10:15:00-03:00',
    remaining_days: 120,
    penalty_rate: 10,
  },
}));

const club: ClubDetail = {
  id: clubId,
  name: clubName,
  acronym: 'AUR',
  cash: 300,
  squad_value: 360,
  net_worth: 660,
  players: roster,
};

const clubSummary: ClubSummary = {
  id: club.id,
  name: club.name,
  acronym: club.acronym,
  cash: club.cash,
  squad_value: club.squad_value,
  net_worth: club.net_worth,
};

const savedLineup: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: false,
  players: playerDetails.filter((player) => [1, 2, 7, 10].includes(player.id)),
};

const transactions: ClubTransactionsResponse = {
  data: [],
  summary: {
    total_spent: 0,
    total_received: 0,
    total_fees: 0,
    total_penalties: 0,
    total_profit: 0,
  },
};

const formationSlots = [
  {
    value: '3-1',
    slots: [
      'Goleiro GOL',
      'Defesa ZAG ou LAT',
      'Defesa ZAG ou LAT',
      'Defesa ZAG ou LAT',
      'Ataque ATA',
    ],
  },
  {
    value: '2-2',
    slots: [
      'Goleiro GOL',
      'Defesa ZAG ou LAT',
      'Defesa ZAG ou LAT',
      'Ataque ATA',
      'Ataque ATA',
    ],
  },
  {
    value: '2-1-1',
    slots: [
      'Goleiro GOL',
      'Defesa ZAG ou LAT',
      'Defesa ZAG ou LAT',
      'Meio MEI',
      'Ataque ATA',
    ],
  },
  {
    value: '1-2-1',
    slots: [
      'Goleiro GOL',
      'Defesa ZAG ou LAT',
      'Meio MEI',
      'Meio MEI',
      'Ataque ATA',
    ],
  },
] as const;

async function mockClubApi(page: Page) {
  const lineupWrites: Array<{ method: string; body: unknown }> = [];
  const unexpectedRequests: string[] = [];
  const documentNavigations: string[] = [];

  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentNavigations.push(request.url());
    }
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({ json: [clubSummary] });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}`
    ) {
      await route.fulfill({ json: club });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}/lineup`
    ) {
      await route.fulfill({ json: savedLineup });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}/transactions`
    ) {
      await route.fulfill({ json: transactions });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      await route.fulfill({
        json: {
          data: [],
          meta: {
            page: 1,
            limit: 1,
            total_items: playerDetails.length,
            total_pages: 12,
          },
        },
      });
      return;
    }
    if (
      request.method() === 'PUT' &&
      url.pathname === `/api/v1/clubs/${clubId}/lineup`
    ) {
      lineupWrites.push({
        method: request.method(),
        body: request.postDataJSON(),
      });
      await route.fulfill({ json: savedLineup });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    lineupWrites,
    unexpectedRequests,
    documentNavigations,
    expectNoWrites() {
      expect(lineupWrites).toEqual([]);
    },
    expectNoUnexpectedRequests() {
      expect(unexpectedRequests).toEqual([]);
    },
    expectNoReload() {
      expect(documentNavigations).toHaveLength(1);
    },
  };
}

async function openLineup(page: Page) {
  await page.goto(`/clubes/${clubId}`);
  await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
  await page.getByRole('tab').filter({ hasText: 'Escala' }).click();
  return page.getByRole('tabpanel');
}

function formationRadio(panel: Locator, formation: string) {
  return panel.locator(`#formation-${formation}`);
}

function slotSelector(panel: Locator, slot: string, index = 0) {
  return panel
    .getByRole('combobox', { name: `Titular para ${slot}` })
    .nth(index);
}

async function chooseVisiblePlayer(page: Page, playerName: string) {
  const listbox = page.getByRole('listbox');
  await expect(
    listbox.getByRole('option', { name: new RegExp(playerName) }),
  ).toBeVisible();
  await listbox.getByRole('option', { name: new RegExp(playerName) }).click();
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    scrollX: window.scrollX,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.scrollX).toBe(0);
}

test('lineup exposes four formations, filters eligible players, and validates incomplete slots', async ({
  page,
}) => {
  const api = await mockClubApi(page);
  const panel = await openLineup(page);
  const table = panel.getByRole('table');

  await expect(
    panel.getByText('Escalação incompleta:', { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: /Salvar escala/ }),
  ).toBeDisabled();

  for (const formation of formationSlots) {
    await formationRadio(panel, formation.value).click();
    await expect(formationRadio(panel, formation.value)).toHaveAttribute(
      'data-state',
      'checked',
    );
    await expect(table.getByRole('row')).toHaveCount(
      formation.slots.length + 1,
    );

    const slotNames = await table
      .getByRole('row')
      .evaluateAll((rows) =>
        rows
          .slice(1)
          .map((row) =>
            row.querySelector('td')?.innerText?.replace(/\s+/g, ' ').trim(),
          ),
      );
    expect(slotNames).toEqual([...formation.slots]);
  }

  await formationRadio(panel, '2-1-1').click();

  const goalkeeper = slotSelector(panel, 'Goleiro (GOL)');
  await goalkeeper.click();
  let options = page.getByRole('listbox').getByRole('option');
  await expect(options.filter({ hasText: 'Goleiro Ativo' })).toBeVisible();
  await expect(options.filter({ hasText: 'Zagueiro Um' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Zagueiro Doente' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const secondDefense = slotSelector(panel, 'Defesa (ZAG ou LAT)', 1);
  await secondDefense.click();
  options = page.getByRole('listbox').getByRole('option');
  await expect(options.filter({ hasText: 'Zagueiro Um' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Zagueiro Doente' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Zagueiro Dois' })).toBeVisible();
  await expect(options.filter({ hasText: 'Lateral Um' })).toBeVisible();
  await expect(options.filter({ hasText: 'Meia Apto' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Atacante Ativo' })).toHaveCount(0);
  await chooseVisiblePlayer(page, 'Lateral Um');

  const firstDefense = slotSelector(panel, 'Defesa (ZAG ou LAT)', 0);
  await firstDefense.click();
  options = page.getByRole('listbox').getByRole('option');
  await expect(options.filter({ hasText: 'Lateral Um' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Zagueiro Doente' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const midfield = slotSelector(panel, 'Meio (MEI)');
  await midfield.click();
  options = page.getByRole('listbox').getByRole('option');
  await expect(options.filter({ hasText: 'Meia Condicionado' })).toBeVisible();
  await expect(options.filter({ hasText: 'Meia Doente' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Zagueiro Um' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Atacante Ativo' })).toHaveCount(0);
  await chooseVisiblePlayer(page, 'Meia Condicionado');
  const midfieldRow = table.getByRole('row').nth(4);
  await expect(midfieldRow.getByText('Mal condicionado')).toBeVisible();

  const attack = slotSelector(panel, 'Ataque (ATA)');
  await attack.click();
  options = page.getByRole('listbox').getByRole('option');
  await expect(
    options.filter({ hasText: 'Atacante Condicionado' }),
  ).toBeVisible();
  await expect(options.filter({ hasText: 'Atacante Doente' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Zagueiro Dois' })).toHaveCount(0);
  await expect(options.filter({ hasText: 'Meia Apto' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await formationRadio(panel, '2-2').click();
  const secondAttack = slotSelector(panel, 'Ataque (ATA)', 1);
  const missingSlotRow = table.getByRole('row').nth(5);
  await expect(secondAttack).toHaveAttribute('aria-invalid', 'true');
  await expect(
    missingSlotRow.getByText('Selecione um titular para esta vaga.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: /Salvar escala/ }),
  ).toBeDisabled();
  api.expectNoWrites();

  await panel.getByRole('button', { name: 'Cancelar' }).click();
  await expect(formationRadio(panel, '2-1-1')).toHaveAttribute(
    'data-state',
    'checked',
  );
  await expect(slotSelector(panel, 'Meio (MEI)')).toContainText('Meia Apto');
  await expect(slotSelector(panel, 'Defesa (ZAG ou LAT)', 1)).toHaveText(
    /Selecione um jogador/,
  );
  api.expectNoWrites();
  api.expectNoUnexpectedRequests();
  api.expectNoReload();
});

test('lineup controls and its wide table remain usable at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await mockClubApi(page);
  const panel = await openLineup(page);
  const table = panel.getByRole('table');
  const tableContainer = panel.locator('[data-slot="table-container"]').first();

  await expect(table).toBeVisible();
  const tableSize = await tableContainer.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(tableSize.width).toBeLessThanOrEqual(375);
  expect(tableSize.scrollWidth).toBeGreaterThan(tableSize.width);
  expect(tableSize.overflowX).toMatch(/auto|scroll/);
  await tableContainer.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await tableContainer.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  await expectNoPageOverflow(page);

  const midfield = slotSelector(panel, 'Meio (MEI)');
  await midfield.click();
  const option = page
    .getByRole('listbox')
    .getByRole('option', { name: /Meia Condicionado/ });
  await expect(option).toBeVisible();
  await expect(option).toBeInViewport();
  await option.click();
  await expect(midfield).toContainText('Meia Condicionado');
  await expect(
    panel.getByRole('button', { name: /Salvar escala/ }),
  ).toBeDisabled();
  await expectNoPageOverflow(page);

  await panel.getByRole('button', { name: 'Cancelar' }).click();
  api.expectNoWrites();
  api.expectNoUnexpectedRequests();
  api.expectNoReload();
  await expectNoPageOverflow(page);
});
