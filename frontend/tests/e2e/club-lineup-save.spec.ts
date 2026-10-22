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

const players: PlayerDetail[] = [
  makePlayer(1, 'Goleiro Ativo', 'GOL'),
  makePlayer(2, 'Zagueiro Um', 'ZAG'),
  makePlayer(3, 'Lateral Um', 'LAT'),
  makePlayer(4, 'Meia Apto', 'MEI'),
  makePlayer(5, 'Meia Condicionado', 'MEI', 'MAL_CONDICIONADO'),
  makePlayer(6, 'Atacante Ativo', 'ATA'),
  makePlayer(7, 'Atacante Condicionado', 'ATA', 'MAL_CONDICIONADO'),
  makePlayer(8, 'Zagueiro Doente', 'ZAG', 'DOENTE'),
];

const roster: ClubRosterPlayer[] = players.map((player) => ({
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
  squad_value: 240,
  net_worth: 540,
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

function asLineupPlayers(ids: number[]): PlayerDetail[] {
  return players.filter((player) => ids.includes(player.id));
}

const incompleteLineup: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: false,
  players: asLineupPlayers([1, 2, 4, 6]),
};

const completedLineup: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: true,
  // The API returns the two defenders in roster order, which differs from the
  // order selected in the form. The screen should hydrate from this response.
  players: asLineupPlayers([1, 2, 3, 5, 6]),
};

const lineupAfterConflict: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: false,
  players: asLineupPlayers([1, 2, 4, 7]),
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

interface SaveReply {
  status: number;
  json: ClubLineup | { message: string };
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function mockApi(page: Page) {
  const writes: Array<{ url: string; body: unknown }> = [];
  const unexpectedRequests: string[] = [];
  const documentNavigations: string[] = [];
  let lineupReads = 0;
  let persistedLineup = incompleteLineup;
  let refetchLineup = incompleteLineup;
  let reply: SaveReply = { status: 200, json: completedLineup };
  let putGate: Promise<void> | undefined;
  let refreshGate: Promise<void> | undefined;

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
      lineupReads += 1;
      if (lineupReads > 1 && refreshGate) await refreshGate;
      await route.fulfill({ json: persistedLineup });
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
            total_items: players.length,
            total_pages: players.length,
          },
        },
      });
      return;
    }
    if (
      request.method() === 'PUT' &&
      url.pathname === `/api/v1/clubs/${clubId}/lineup`
    ) {
      writes.push({ url: url.pathname, body: request.postDataJSON() });
      if (putGate) await putGate;
      if (reply.status >= 200 && reply.status < 300) {
        persistedLineup = reply.json as ClubLineup;
      } else {
        persistedLineup = refetchLineup;
      }
      await route.fulfill({ status: reply.status, json: reply.json });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    writes,
    unexpectedRequests,
    documentNavigations,
    get lineupReads() {
      return lineupReads;
    },
    setReply(nextReply: SaveReply) {
      reply = nextReply;
    },
    setRefetchLineup(nextLineup: ClubLineup) {
      refetchLineup = nextLineup;
    },
    holdPut(promise: Promise<void>) {
      putGate = promise;
    },
    holdRefresh(promise: Promise<void>) {
      refreshGate = promise;
    },
    expectWrite(body: unknown) {
      expect(writes).toEqual([{ url: `/api/v1/clubs/${clubId}/lineup`, body }]);
    },
    expectEnd() {
      expect(unexpectedRequests).toEqual([]);
      expect(documentNavigations).toHaveLength(1);
    },
  };
}

async function openLineup(page: Page, width: number) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(`/clubes/${clubId}`);
  await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
  await page.getByRole('tab').filter({ hasText: 'Escala' }).click();
  return page.getByRole('tabpanel');
}

function slotSelector(panel: Locator, slot: string, index = 0) {
  return panel
    .getByRole('combobox', { name: `Titular para ${slot}` })
    .nth(index);
}

async function choosePlayer(page: Page, trigger: Locator, playerName: string) {
  await trigger.click();
  const option = page
    .getByRole('listbox')
    .getByRole('option', { name: new RegExp(playerName) });
  await expect(option).toBeVisible();
  await option.click();
}

async function completeDraft(page: Page, panel: Locator) {
  await choosePlayer(
    page,
    slotSelector(panel, 'Defesa (ZAG ou LAT)', 0),
    'Lateral Um',
  );
  await choosePlayer(
    page,
    slotSelector(panel, 'Defesa (ZAG ou LAT)', 1),
    'Zagueiro Um',
  );
  await choosePlayer(
    page,
    slotSelector(panel, 'Meio (MEI)'),
    'Meia Condicionado',
  );
  await expect(
    panel.getByRole('button', { name: /Salvar escala/ }),
  ).toBeEnabled();
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

for (const viewport of [
  { label: 'desktop', width: 1366 },
  { label: '375px', width: 375 },
]) {
  test(`saves the API lineup once after double click and blocks controls at ${viewport.label}`, async ({
    page,
  }) => {
    const api = await mockApi(page);
    const put = gate();
    const refresh = gate();
    api.holdPut(put.promise);
    api.holdRefresh(refresh.promise);
    const panel = await openLineup(page, viewport.width);
    await completeDraft(page, panel);

    const save = panel.getByRole('button', { name: /Salvar escala/ });
    const cancel = panel.getByRole('button', { name: 'Cancelar' });
    const formation = panel.locator('#formation-2-1-1');
    const defender = slotSelector(panel, 'Defesa (ZAG ou LAT)', 0);
    const firstPut = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        new URL(request.url()).pathname === `/api/v1/clubs/${clubId}/lineup`,
    );

    try {
      await save.dblclick();
      await firstPut;
      await expect.poll(() => api.writes.length).toBe(1);
      api.expectWrite({
        formation: '2-1-1',
        player_ids: [1, 3, 2, 5, 6],
      });
      await expect(save).toBeDisabled();
      await expect(cancel).toBeDisabled();
      await expect(formation).toBeDisabled();
      await expect(defender).toBeDisabled();
      await expect(
        page.locator('[data-sonner-toast]').getByText('Escalação salva', {
          exact: true,
        }),
      ).toHaveCount(0);

      put.release();
      await expect.poll(() => api.lineupReads).toBe(2);
      await expect(save).toBeDisabled();
      await expect(cancel).toBeDisabled();
      await expect(
        page.locator('[data-sonner-toast]').getByText('Escalação salva', {
          exact: true,
        }),
      ).toHaveCount(0);

      refresh.release();
      const toast = page.locator('[data-sonner-toast]').filter({
        hasText: 'Escalação salva',
      });
      await expect(
        toast.getByText('Escalação salva', { exact: true }),
      ).toBeVisible();
      await expect(
        toast.getByText(
          `${clubName} na 2-1-1, com 5 titulares devolvidos pela API.`,
          { exact: true },
        ),
      ).toBeVisible();

      await expect(slotSelector(panel, 'Defesa (ZAG ou LAT)', 0)).toContainText(
        'Zagueiro Um',
      );
      await expect(slotSelector(panel, 'Defesa (ZAG ou LAT)', 1)).toContainText(
        'Lateral Um',
      );
      await expect(slotSelector(panel, 'Meio (MEI)')).toContainText(
        'Meia Condicionado',
      );
      await expect(panel.getByText('Completa', { exact: true })).toBeVisible();
      api.expectWrite({
        formation: '2-1-1',
        player_ids: [1, 3, 2, 5, 6],
      });
      api.expectEnd();
      if (viewport.width === 375) await expectNoPageOverflow(page);
    } finally {
      put.release();
      refresh.release();
    }
  });
}

for (const failure of [
  {
    status: 400,
    message: 'Escalacao invalida enviada para o clube.',
    refreshedLineup: incompleteLineup,
  },
  {
    status: 404,
    message: 'O clube nao existe mais.',
    refreshedLineup: incompleteLineup,
  },
  {
    status: 409,
    message: 'Zagueiro Um esta DOENTE e nao pode ser escalado.',
    refreshedLineup: lineupAfterConflict,
  },
]) {
  test(`shows the exact API message and reloads persisted lineup after ${failure.status}`, async ({
    page,
  }) => {
    const api = await mockApi(page);
    api.setReply({
      status: failure.status,
      json: { message: failure.message },
    });
    api.setRefetchLineup(failure.refreshedLineup);
    const panel = await openLineup(page, 1366);
    await completeDraft(page, panel);
    const lineupReadsBeforeSave = api.lineupReads;

    await panel.getByRole('button', { name: /Salvar escala/ }).click();
    await expect(
      page.getByText(failure.message, { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText('A escalação foi recusada')).toBeVisible();
    await expect
      .poll(() => api.lineupReads)
      .toBeGreaterThan(lineupReadsBeforeSave);
    api.expectWrite({
      formation: '2-1-1',
      player_ids: [1, 3, 2, 5, 6],
    });

    await expect(slotSelector(panel, 'Defesa (ZAG ou LAT)', 1)).toHaveText(
      /Selecione um jogador/,
    );
    await expect(
      panel.getByRole('button', { name: /Salvar escala/ }),
    ).toBeDisabled();
    if (failure.status === 409) {
      await expect(slotSelector(panel, 'Ataque (ATA)')).toContainText(
        'Atacante Condicionado',
      );
      await expect(slotSelector(panel, 'Meio (MEI)')).toContainText(
        'Meia Apto',
      );
    }
    api.expectEnd();
  });
}
