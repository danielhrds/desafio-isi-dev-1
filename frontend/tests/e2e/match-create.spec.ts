import { expect, test, type Page } from '@playwright/test';
import type { ClubSummary } from '../../src/types/club';
import type {
  MatchDetail,
  MatchDuel,
  MatchSummary,
} from '../../src/types/match';

const clubs: ClubSummary[] = [
  {
    id: 1,
    name: 'Aurora FC',
    acronym: 'AUR',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
  {
    id: 2,
    name: 'Delta FC',
    acronym: 'DEL',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
  {
    id: 3,
    name: 'Gama SC',
    acronym: 'GAM',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
];

function duel(
  order: number,
  attackingClubId: number,
  attacker: MatchDuel['attacker'],
  defender: MatchDuel['defender'],
  goal: boolean,
): MatchDuel {
  return {
    order,
    attacking_club_id: attackingClubId,
    attacker,
    defender,
    goal,
  };
}

const match: MatchDetail = {
  id: 51,
  played_at: '2026-11-11T20:00:00-03:00',
  home: {
    club_id: 1,
    club_name: 'Aurora FC',
    formation: '2-1-1',
    goals: 2,
  },
  away: {
    club_id: 2,
    club_name: 'Delta FC',
    formation: '2-1-1',
    goals: 1,
  },
  result: 'MANDANTE',
  duels: [
    duel(
      1,
      1,
      {
        player_id: 11,
        player_name: 'Gabriel Antunes',
        position: 'ATA',
        condition: 'APTO',
        attribute: 'shooting',
        value: 81,
      },
      {
        player_id: 21,
        player_name: 'Bruno Tavares',
        position: 'GOL',
        condition: 'APTO',
        attribute: 'defending',
        value: 77,
      },
      true,
    ),
    duel(
      2,
      1,
      {
        player_id: 12,
        player_name: 'Meia Lua',
        position: 'MEI',
        condition: 'APTO',
        attribute: 'passing',
        value: 65,
      },
      {
        player_id: 22,
        player_name: 'Felipe Moura',
        position: 'ZAG',
        condition: 'APTO',
        attribute: 'defending',
        value: 72,
      },
      false,
    ),
    duel(
      3,
      1,
      {
        player_id: 13,
        player_name: 'Kauã Ribeiro',
        position: 'LAT',
        condition: 'MAL_CONDICIONADO',
        attribute: 'dribbling',
        value: 75,
      },
      {
        player_id: 23,
        player_name: 'Diego Ramos',
        position: 'LAT',
        condition: 'APTO',
        attribute: 'defending',
        value: 56,
      },
      true,
    ),
    duel(
      4,
      2,
      {
        player_id: 24,
        player_name: 'João Silva',
        position: 'ATA',
        condition: 'APTO',
        attribute: 'shooting',
        value: 70,
      },
      {
        player_id: 14,
        player_name: 'André Lacerda',
        position: 'GOL',
        condition: 'APTO',
        attribute: 'defending',
        value: 74,
      },
      false,
    ),
    duel(
      5,
      2,
      {
        player_id: 25,
        player_name: 'Sávio Lima',
        position: 'MEI',
        condition: 'MAL_CONDICIONADO',
        attribute: 'passing',
        value: 60,
      },
      {
        player_id: 15,
        player_name: 'Danilo Freitas',
        position: 'ZAG',
        condition: 'APTO',
        attribute: 'defending',
        value: 67,
      },
      false,
    ),
    duel(
      6,
      2,
      {
        player_id: 26,
        player_name: 'Diego Ramos',
        position: 'LAT',
        condition: 'APTO',
        attribute: 'dribbling',
        value: 63,
      },
      {
        player_id: 16,
        player_name: 'Kauã Ribeiro',
        position: 'LAT',
        condition: 'APTO',
        attribute: 'defending',
        value: 63,
      },
      true,
    ),
  ],
};

const matchSummary: MatchSummary = {
  id: match.id,
  played_at: match.played_at,
  home: match.home,
  away: match.away,
  result: match.result,
};

type ApiPost = { url: string; body: unknown };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function mockApi(page: Page) {
  const posts: ApiPost[] = [];
  const unexpectedRequests: string[] = [];
  const documentNavigations: string[] = [];
  let postReply: { status: number; body: unknown } = {
    status: 201,
    body: match,
  };
  let postGate: Promise<void> | undefined;
  let created = false;

  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentNavigations.push(request.url());
    }
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({ json: clubs });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      await route.fulfill({
        json: {
          data: [],
          meta: { page: 1, limit: 1, total_items: 0, total_pages: 0 },
        },
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/matches') {
      await route.fulfill({ json: created ? [matchSummary] : [] });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/matches/${match.id}`
    ) {
      await route.fulfill({ json: match });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/standings') {
      await route.fulfill({ json: [] });
      return;
    }

    if (request.method() === 'POST' && url.pathname === '/api/v1/matches') {
      posts.push({ url: url.pathname, body: request.postDataJSON() });
      if (postGate) await postGate;

      if (postReply.status === 201) created = true;
      await route.fulfill({ status: postReply.status, json: postReply.body });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    posts,
    unexpectedRequests,
    documentNavigations,
    setPostReply(reply: { status: number; body: unknown }) {
      postReply = reply;
    },
    holdPost(gate: Promise<void>) {
      postGate = gate;
    },
    resetDocumentNavigations() {
      documentNavigations.length = 0;
    },
  };
}

async function openCreateDialog(page: Page) {
  await page.goto('/partidas');
  await expect(
    page.getByRole('heading', { name: 'Partidas', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Nova partida' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function selectClub(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function blurEmptyClubSelect(page: Page, label: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.keyboard.press('Escape');
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

for (const [label, errorId] of [
  ['Mandante', 'create-match-home-error'],
  ['Visitante', 'create-match-away-error'],
] as const) {
  test(`valida ${label.toLocaleLowerCase('pt-BR')} obrigatório junto ao campo sem enviar POST`, async ({
    page,
  }) => {
    const api = await mockApi(page);
    await openCreateDialog(page);
    await blurEmptyClubSelect(page, label);

    const field = page.getByRole('combobox', { name: label });
    await expect(page.locator(`#${errorId}`)).toHaveText('Selecione um clube.');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAttribute('aria-describedby', errorId);
    await expect(
      page.getByRole('button', { name: 'Jogar partida' }),
    ).toBeDisabled();
    expect(api.posts).toHaveLength(0);
    expect(api.unexpectedRequests).toEqual([]);
  });
}

for (const viewport of [
  { label: 'desktop', width: 1366, height: 900 },
  { label: '375 px', width: 375, height: 812 },
]) {
  test(`cria partida com resposta da API, uma requisição e detalhe utilizável em ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page);
    const post = deferred();
    api.holdPost(post.promise);
    await openCreateDialog(page);
    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page);
    }

    await selectClub(page, 'Mandante', 'Aurora FC (AUR)');
    await selectClub(page, 'Visitante', 'Delta FC (DEL)');
    const submit = page.getByRole('button', { name: 'Jogar partida' });
    await expect(submit).toBeEnabled();
    api.resetDocumentNavigations();

    await submit.dblclick({ delay: 30 });
    await expect.poll(() => api.posts.length).toBe(1);
    expect(api.posts).toEqual([
      {
        url: '/api/v1/matches',
        body: { home_club_id: 1, away_club_id: 2 },
      },
    ]);
    await expect(
      page.getByRole('button', { name: 'Jogando partida...' }),
    ).toBeDisabled();
    await expect(
      page.getByRole('combobox', { name: 'Mandante' }),
    ).toBeDisabled();
    await expect(
      page.getByRole('combobox', { name: 'Visitante' }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Jogando partida...' }),
    ).toBeDisabled();

    post.resolve();
    await expect(page).toHaveURL(/\/partidas\/51$/);
    await expect(
      page.getByText('Partida jogada com sucesso.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('2 × 1', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Vitória do mandante', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('11/11/2026, 20:00')).toBeVisible();
    expect(api.documentNavigations).toHaveLength(0);
    expect(api.posts).toHaveLength(1);
    expect(api.unexpectedRequests).toEqual([]);

    const duelsTable = page.getByRole('table', {
      name: 'Seis duelos da partida',
    });
    await expect(duelsTable).toBeVisible();
    const duelRows = duelsTable.locator('tbody > tr');
    await expect(duelRows).toHaveCount(8);
    for (const duelData of match.duels) {
      const duelRow = duelRows.nth(
        duelData.order + (duelData.order > 3 ? 1 : 0),
      );
      const attackLabel = {
        shooting: 'Finalização',
        passing: 'Passe',
        dribbling: 'Drible',
      }[duelData.attacker.attribute as 'shooting' | 'passing' | 'dribbling'];

      await expect(duelRow).toHaveCount(1);
      await expect(duelRow).toContainText(duelData.attacker.player_name);
      await expect(duelRow).toContainText(attackLabel);
      await expect(duelRow).toContainText(String(duelData.attacker.value));
      await expect(duelRow).toContainText(duelData.defender.player_name);
      await expect(duelRow).toContainText(String(duelData.defender.value));
      await expect(duelRow).toContainText(duelData.goal ? 'Gol' : 'Sem gol');
    }

    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page);
      const tableContainer = duelsTable.locator('xpath=..');
      const scrollMetrics = await tableContainer.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
        overflowX: getComputedStyle(element).overflowX,
      }));

      expect(scrollMetrics.scroll).toBeGreaterThan(scrollMetrics.client);
      expect(scrollMetrics.overflowX).toBe('auto');
    }
  });
}

test('mostra exatamente a recusa 409 da API e destaca o mandante incompleto como em L04', async ({
  page,
}) => {
  const api = await mockApi(page);
  const message = 'Escalação incompleta: o Gama SC não tem os 5 titulares.';
  api.setPostReply({ status: 409, body: { message, club_id: 3 } });
  await openCreateDialog(page);
  await selectClub(page, 'Mandante', 'Gama SC (GAM)');
  await selectClub(page, 'Visitante', 'Aurora FC (AUR)');
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/matches',
  );
  await page.getByRole('button', { name: 'Jogar partida' }).click();

  await expect.poll(() => api.posts.length).toBe(1);
  const response = await responsePromise;
  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ message, club_id: 3 });
  expect(api.posts).toEqual([
    {
      url: '/api/v1/matches',
      body: { home_club_id: 3, away_club_id: 1 },
    },
  ]);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText(
    'Não foi possível jogar a partida',
  );
  await expect(dialog.getByText(message, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/partidas$/);
  const incompleteClubSelect = page.getByRole('combobox', {
    name: 'Mandante',
  });
  await expect(incompleteClubSelect).toHaveAttribute('aria-invalid', 'true');
  await expect(incompleteClubSelect).toHaveAttribute(
    'aria-describedby',
    'create-match-request-error',
  );
  await expect(
    page.getByRole('combobox', { name: 'Visitante' }),
  ).toHaveAttribute('aria-invalid', 'false');
  expect(api.unexpectedRequests).toEqual([]);
});

test('mostra exatamente a recusa 409 e destaca o visitante incompleto em 375 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await mockApi(page);
  const message = 'Escalação incompleta: o Gama SC não tem os 5 titulares.';
  api.setPostReply({ status: 409, body: { message, club_id: 3 } });
  await openCreateDialog(page);
  await expectNoHorizontalPageOverflow(page);
  await selectClub(page, 'Mandante', 'Aurora FC (AUR)');
  await selectClub(page, 'Visitante', 'Gama SC (GAM)');

  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/v1/matches',
  );
  await page.getByRole('button', { name: 'Jogar partida' }).click();

  await expect.poll(() => api.posts.length).toBe(1);
  const response = await responsePromise;
  expect(response.status()).toBe(409);
  expect(await response.json()).toEqual({ message, club_id: 3 });
  expect(api.posts).toEqual([
    {
      url: '/api/v1/matches',
      body: { home_club_id: 1, away_club_id: 3 },
    },
  ]);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('alert')).toContainText(
    'Não foi possível jogar a partida',
  );
  await expect(dialog.getByText(message, { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/partidas$/);

  const awayClubSelect = page.getByRole('combobox', { name: 'Visitante' });
  await awayClubSelect.scrollIntoViewIfNeeded();
  await expect(awayClubSelect).toBeInViewport();
  await expect(awayClubSelect).toHaveAttribute('aria-invalid', 'true');
  await expect(awayClubSelect).toHaveAttribute(
    'aria-describedby',
    'create-match-request-error',
  );
  await expect(
    page.getByRole('combobox', { name: 'Mandante' }),
  ).toHaveAttribute('aria-invalid', 'false');
  expect(api.posts).toHaveLength(1);
  expect(api.unexpectedRequests).toEqual([]);
  await expectNoHorizontalPageOverflow(page);
});
