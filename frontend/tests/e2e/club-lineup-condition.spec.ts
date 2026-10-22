import { expect, test, type Page } from '@playwright/test';
import type {
  ClubDetail,
  ClubLineup,
  ClubListItem,
  ClubRosterPlayer,
  ClubSummary,
} from '../../src/types/club';
import type { PlayerDetail } from '../../src/types/player';

const clubId = 1;
const clubName = 'Aurora FC';
const affectedPlayerId = 4;
const affectedPlayerName = 'Meia Titular';

function makePlayer(
  id: number,
  name: string,
  position: PlayerDetail['position'],
): PlayerDetail {
  return {
    id,
    name,
    position,
    overall: 70 + id,
    agility: 70,
    age: 24,
    condition: 'APTO',
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

const goalkeeper = makePlayer(1, 'Goleiro Titular', 'GOL');
const defenderOne = makePlayer(2, 'Zagueiro Titular', 'ZAG');
const defenderTwo = makePlayer(3, 'Lateral Titular', 'LAT');
const midfielder = makePlayer(affectedPlayerId, affectedPlayerName, 'MEI');
const striker = makePlayer(5, 'Atacante Titular', 'ATA');
const sickMidfielder: PlayerDetail = {
  ...midfielder,
  condition: 'DOENTE',
  market_value: 18,
};

function withContract(player: PlayerDetail): ClubRosterPlayer {
  return {
    ...player,
    club_id: clubId,
    contract: {
      purchase_value: 25,
      loyalty_until: '2027-03-02T10:15:00-03:00',
      remaining_days: 120,
      penalty_rate: 10,
    },
  };
}

const summary: ClubSummary = {
  id: clubId,
  name: clubName,
  acronym: 'AUR',
  cash: 300,
  squad_value: 150,
  net_worth: 450,
};
const sidebarClub: ClubListItem = {
  id: summary.id,
  name: summary.name,
  acronym: summary.acronym,
};
const clubBeforeConditionChange: ClubDetail = {
  ...summary,
  players: [goalkeeper, defenderOne, defenderTwo, midfielder, striker].map(
    withContract,
  ),
};
const clubAfterConditionChange: ClubDetail = {
  ...summary,
  players: [goalkeeper, defenderOne, defenderTwo, sickMidfielder, striker].map(
    withContract,
  ),
};
const lineupBeforeConditionChange: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: true,
  players: [goalkeeper, defenderOne, defenderTwo, midfielder, striker],
};
const lineupAfterConditionChange: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: false,
  players: [goalkeeper, defenderOne, defenderTwo, striker],
};
const playerListBeforeConditionChange = [
  goalkeeper,
  defenderOne,
  defenderTwo,
  midfielder,
  striker,
];
const playerListAfterConditionChange = [
  goalkeeper,
  defenderOne,
  defenderTwo,
  sickMidfielder,
  striker,
];
const emptyTransactions = {
  data: [],
  summary: {
    total_spent: 0,
    total_received: 0,
    total_fees: 0,
    total_penalties: 0,
    total_profit: 0,
  },
};

async function mockApi(page: Page) {
  const conditionPatches: Array<{ url: string; body: unknown }> = [];
  const lineupReads: boolean[] = [];
  const lineupWrites: unknown[] = [];
  const unexpectedRequests: string[] = [];
  let conditionChanged = false;

  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentNavigations.push(request.url());
    }
  });
  const documentNavigations: string[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({ json: [sidebarClub] });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}`
    ) {
      await route.fulfill({
        json: conditionChanged
          ? clubAfterConditionChange
          : clubBeforeConditionChange,
      });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}/lineup`
    ) {
      lineupReads.push(conditionChanged);
      await route.fulfill({
        json: conditionChanged
          ? lineupAfterConditionChange
          : lineupBeforeConditionChange,
      });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}/transactions`
    ) {
      await route.fulfill({ json: emptyTransactions });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      const players = conditionChanged
        ? playerListAfterConditionChange
        : playerListBeforeConditionChange;
      const limit = Number(url.searchParams.get('limit') ?? 10);
      await route.fulfill({
        json: {
          data: players.slice(0, limit),
          meta: {
            page: Number(url.searchParams.get('page') ?? 1),
            limit,
            total_items: players.length,
            total_pages: 1,
          },
        },
      });
      return;
    }
    if (
      request.method() === 'PATCH' &&
      url.pathname === `/api/v1/players/${affectedPlayerId}/condition`
    ) {
      conditionPatches.push({
        url: url.pathname,
        body: request.postDataJSON(),
      });
      conditionChanged = true;
      await route.fulfill({ json: sickMidfielder });
      return;
    }
    if (
      request.method() === 'PUT' &&
      url.pathname === `/api/v1/clubs/${clubId}/lineup`
    ) {
      lineupWrites.push(request.postDataJSON());
      await route.fulfill({ json: lineupAfterConditionChange });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    conditionPatches,
    documentNavigations,
    lineupReads,
    lineupWrites,
    unexpectedRequests,
  };
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    scrollX: window.scrollX,
  }));
  expect(dimensions).toEqual({
    viewport: 375,
    document: 375,
    body: 375,
    scrollX: 0,
  });
}

async function clickSidebarLink(page: Page, label: string) {
  await page.getByRole('button', { name: 'Alternar menu' }).click();
  const sidebar = page.getByRole('dialog', { name: 'Sidebar', exact: true });
  await expect(sidebar).toBeVisible();
  const link = sidebar.getByRole('link', { name: label });
  await expect(link).toBeInViewport({ ratio: 1 });
  await link.click();
}

test('refreshes lineup after a starter becomes sick without reloading at 375px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await mockApi(page);

  await page.goto(`/clubes/${clubId}`);
  await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
  await expect.poll(() => api.lineupReads.length).toBeGreaterThan(0);
  await page.getByRole('tab', { name: 'Escalação' }).click();
  let lineupPanel = page.getByRole('tabpanel');
  await expect(
    lineupPanel.getByText('Completa', { exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);

  await clickSidebarLink(page, 'Jogadores');
  await expect(page.getByRole('heading', { name: 'Jogadores' })).toBeVisible();
  const playerRow = page
    .getByRole('table', { name: 'Jogadores', exact: true })
    .getByRole('row')
    .filter({ hasText: affectedPlayerName });
  const actions = playerRow.getByRole('button', {
    name: `Abrir ações de ${affectedPlayerName}`,
  });
  await actions.scrollIntoViewIfNeeded();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Alterar condição' }).click();

  const conditionDialog = page.getByRole('dialog', {
    name: 'Alterar condição física',
  });
  await expect(conditionDialog).toBeVisible();
  await expect(conditionDialog).toBeInViewport({ ratio: 1 });
  await conditionDialog.locator('#condition-DOENTE').check();
  await conditionDialog
    .getByRole('button', { name: 'Salvar condição' })
    .click();
  await expect(conditionDialog).toHaveCount(0);
  const successToast = page.locator('[data-sonner-toast]');
  await expect(
    successToast.getByText('Condição física atualizada', { exact: true }),
  ).toBeVisible();
  await expect(
    successToast.getByText(`${affectedPlayerName} agora está doente.`, {
      exact: true,
    }),
  ).toBeVisible();
  expect(api.conditionPatches).toEqual([
    {
      url: `/api/v1/players/${affectedPlayerId}/condition`,
      body: { condition: 'DOENTE' },
    },
  ]);
  await expectNoPageOverflow(page);

  const previousLineupReadCount = api.lineupReads.length;
  await clickSidebarLink(page, clubName);
  await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
  await expect
    .poll(() => api.lineupReads.length)
    .toBeGreaterThan(previousLineupReadCount);
  expect(api.lineupReads.at(-1)).toBe(true);
  await page.getByRole('tab', { name: 'Escalação' }).click();
  lineupPanel = page.getByRole('tabpanel');
  await expect(
    lineupPanel.getByText(
      `Escalação incompleta: ${clubName} não pode jogar partidas`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    lineupPanel.getByRole('img', { name: 'Vaga de Meio vazia' }),
  ).toBeVisible();
  const midfieldSelector = lineupPanel.getByRole('combobox', {
    name: 'Titular para Meio (MEI)',
  });
  await expect(midfieldSelector).toHaveText('Sem jogadores elegíveis');
  await expect(midfieldSelector).toBeDisabled();
  expect(api.conditionPatches).toHaveLength(1);
  expect(api.lineupWrites).toEqual([]);
  expect(api.documentNavigations).toHaveLength(1);
  expect(api.unexpectedRequests).toEqual([]);
  await expectNoPageOverflow(page);
});
