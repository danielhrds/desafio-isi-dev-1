import { expect, test, type Page } from '@playwright/test';
import type { ClubSummary } from '../../src/types/club';
import type { MatchSummary } from '../../src/types/match';
import type { Standing } from '../../src/types/standing';

const clubs: ClubSummary[] = [
  {
    id: 1,
    name: 'Águias FC',
    acronym: 'AGU',
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
    name: 'Épsilon EC',
    acronym: 'EPS',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
  {
    id: 4,
    name: 'Gama SC',
    acronym: 'GAM',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
  {
    id: 5,
    name: 'Mangue FC',
    acronym: 'MNG',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
  {
    id: 6,
    name: 'Tubarões EC',
    acronym: 'TUB',
    cash: 300,
    squad_value: 0,
    net_worth: 300,
  },
];

const standings: Standing[] = [
  {
    position: 1,
    club_id: 2,
    club_name: 'Delta FC',
    played: 2,
    wins: 2,
    draws: 0,
    losses: 0,
    goals_for: 4,
    goals_against: 2,
    goal_difference: 2,
    points: 6,
  },
  {
    position: 2,
    club_id: 3,
    club_name: 'Épsilon EC',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  },
  {
    position: 3,
    club_id: 4,
    club_name: 'Gama SC',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  },
  {
    position: 4,
    club_id: 5,
    club_name: 'Mangue FC',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  },
  {
    position: 5,
    club_id: 6,
    club_name: 'Tubarões EC',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  },
  {
    position: 6,
    club_id: 1,
    club_name: 'Águias FC',
    played: 2,
    wins: 0,
    draws: 0,
    losses: 2,
    goals_for: 2,
    goals_against: 4,
    goal_difference: -2,
    points: 0,
  },
];

const zeroStandings: Standing[] = [
  {
    position: 1,
    club_id: 1,
    club_name: 'Águias FC',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  },
  {
    position: 2,
    club_id: 4,
    club_name: 'Gama SC',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
  },
];

const recentMatches: MatchSummary[] = [
  {
    id: 71,
    played_at: '2026-11-11T20:00:00-03:00',
    home: {
      club_id: 2,
      club_name: 'Delta FC',
      formation: '2-1-1',
      goals: 2,
    },
    away: {
      club_id: 1,
      club_name: 'Águias FC',
      formation: '2-1-1',
      goals: 1,
    },
    result: 'MANDANTE',
  },
  {
    id: 70,
    played_at: '2026-11-10T20:00:00-03:00',
    home: {
      club_id: 1,
      club_name: 'Águias FC',
      formation: '2-1-1',
      goals: 1,
    },
    away: {
      club_id: 2,
      club_name: 'Delta FC',
      formation: '2-1-1',
      goals: 2,
    },
    result: 'VISITANTE',
  },
];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function mockApi(
  page: Page,
  options?: {
    standings?: Standing[];
    matches?: MatchSummary[];
    holdStandings?: boolean;
    failStandingsUntilRetry?: boolean;
  },
) {
  const standingsRequests: string[] = [];
  const unexpectedRequests: string[] = [];
  const standingsGate = deferred();
  const holdStandings = options?.holdStandings ?? false;
  let retryAllowed = false;

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
      await route.fulfill({ json: options?.matches ?? [] });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/standings') {
      standingsRequests.push(`${url.pathname}${url.search}`);
      if (holdStandings && standingsRequests.length === 1) {
        await standingsGate.promise;
      }
      if (options?.failStandingsUntilRetry && !retryAllowed) {
        await route.fulfill({
          status: 503,
          json: { message: 'Falha ao carregar a classificação da API.' },
        });
        return;
      }

      await route.fulfill({ json: options?.standings ?? standings });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    standingsRequests,
    unexpectedRequests,
    releaseStandings() {
      standingsGate.resolve();
    },
    allowRetry() {
      retryAllowed = true;
    },
  };
}

async function openStandings(page: Page) {
  await page.goto('/classificacao');
  await expect(
    page.getByRole('heading', { name: 'Classificação', exact: true }),
  ).toBeVisible();
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

test('exibe estatísticas, legenda, partidas recentes e desempate conforme as respostas da API', async ({
  page,
}) => {
  const api = await mockApi(page, { standings, matches: recentMatches });
  await openStandings(page);

  const table = page.getByRole('table', { name: 'Classificação dos clubes' });
  const rows = table.locator('tbody > tr');
  await expect(rows).toHaveCount(6);
  const expectedRows = [
    {
      position: '1',
      acronym: 'DEL',
      club: 'Delta FC',
      stats: ['2', '2', '0', '0', '4', '2', '+2', '6'],
    },
    {
      position: '2',
      acronym: 'EPS',
      club: 'Épsilon EC',
      stats: ['0', '0', '0', '0', '0', '0', '0', '0'],
    },
    {
      position: '3',
      acronym: 'GAM',
      club: 'Gama SC',
      stats: ['0', '0', '0', '0', '0', '0', '0', '0'],
    },
    {
      position: '4',
      acronym: 'MNG',
      club: 'Mangue FC',
      stats: ['0', '0', '0', '0', '0', '0', '0', '0'],
    },
    {
      position: '5',
      acronym: 'TUB',
      club: 'Tubarões EC',
      stats: ['0', '0', '0', '0', '0', '0', '0', '0'],
    },
    {
      position: '6',
      acronym: 'AGU',
      club: 'Águias FC',
      stats: ['2', '0', '0', '2', '2', '4', '−2', '0'],
    },
  ];

  for (const [index, expectedRow] of expectedRows.entries()) {
    const cells = rows.nth(index).locator('td');
    await expect(cells.nth(0)).toHaveText(expectedRow.position);
    await expect(
      cells.nth(1).getByText(expectedRow.acronym, { exact: true }),
    ).toBeVisible();
    await expect(
      cells.nth(1).getByRole('link', { name: expectedRow.club, exact: true }),
    ).toBeVisible();
    const stats = await cells.evaluateAll((cellNodes) =>
      cellNodes.slice(2).map((cell) => cell.textContent?.trim() ?? ''),
    );
    expect(stats).toEqual(expectedRow.stats);
  }
  await expect(
    table.getByRole('columnheader', { name: 'Jogos' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Vitórias' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Empates' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Derrotas' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Gols marcados' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Gols sofridos' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Saldo de gols' }),
  ).toBeVisible();
  await expect(
    table.getByRole('columnheader', { name: 'Pontos' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols marcados · GC: gols sofridos · SG: saldo de gols · Pts: pontos',
    ),
  ).toBeVisible();

  const recentLinks = page.locator('main aside a[aria-label]');
  await expect(recentLinks).toHaveCount(2);
  await expect(recentLinks.nth(0)).toHaveAttribute(
    'aria-label',
    'Delta FC 2 a 1 Águias FC, 11/11/2026, 20:00',
  );
  await expect(recentLinks.nth(1)).toHaveAttribute(
    'aria-label',
    'Águias FC 1 a 2 Delta FC, 10/11/2026, 20:00',
  );

  const tieBreakCard = page
    .locator('[data-slot="card"]')
    .filter({ hasText: 'Ordem da tabela' });
  const tieBreakText = (await tieBreakCard.innerText()).replace(/\s+/g, ' ');
  expect(tieBreakText).toContain(
    '1 Mais pontos 2 Maior saldo de gols 3 Mais gols marcados 4 Nome do clube, de A a Z',
  );
  expect(api.standingsRequests).toEqual(['/api/v1/standings']);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mantém clubes e estatísticas zeradas quando não há partidas', async ({
  page,
}) => {
  const api = await mockApi(page, { standings: zeroStandings, matches: [] });
  await openStandings(page);

  const rows = page
    .getByRole('table', { name: 'Classificação dos clubes' })
    .locator('tbody > tr');
  await expect(rows).toHaveCount(2);
  const expectedRows = [
    {
      position: '1',
      acronym: 'AGU',
      club: 'Águias FC',
    },
    {
      position: '2',
      acronym: 'GAM',
      club: 'Gama SC',
    },
  ];
  for (const [index, expectedRow] of expectedRows.entries()) {
    const cells = rows.nth(index).locator('td');
    await expect(cells.nth(0)).toHaveText(expectedRow.position);
    await expect(
      cells.nth(1).getByText(expectedRow.acronym, { exact: true }),
    ).toBeVisible();
    await expect(
      cells.nth(1).getByRole('link', { name: expectedRow.club, exact: true }),
    ).toBeVisible();
    const stats = await cells.evaluateAll((cellNodes) =>
      cellNodes.slice(2).map((cell) => cell.textContent?.trim() ?? ''),
    );
    expect(stats).toEqual(['0', '0', '0', '0', '0', '0', '0', '0']);
  }
  await expect(
    page.getByText('Nenhuma partida jogada', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Classificação dos clubes' }),
  ).toBeVisible();
  expect(api.standingsRequests).toEqual(['/api/v1/standings']);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mostra o estado vazio quando a API informa que não há clubes', async ({
  page,
}) => {
  const api = await mockApi(page, { standings: [], matches: [] });
  await openStandings(page);

  await expect(
    page.getByText('Nenhum clube cadastrado', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Classificação dos clubes' }),
  ).toHaveCount(0);
  expect(api.standingsRequests).toEqual(['/api/v1/standings']);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mantém o carregamento, exibe o erro da API e refaz a consulta ao tentar novamente', async ({
  page,
}) => {
  const api = await mockApi(page, {
    holdStandings: true,
    failStandingsUntilRetry: true,
    standings,
  });
  await openStandings(page);

  await expect(
    page.getByRole('status').filter({ hasText: 'Carregando classificação...' }),
  ).toBeVisible();
  expect(api.standingsRequests).toEqual(['/api/v1/standings']);

  api.releaseStandings();
  await expect(
    page.getByText('Não foi possível carregar a classificação', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText('Falha ao carregar a classificação da API.', {
      exact: true,
    }),
  ).toBeVisible();
  const requestsBeforeRetry = api.standingsRequests.length;

  api.allowRetry();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('table', { name: 'Classificação dos clubes' }),
  ).toBeVisible();
  expect(api.standingsRequests).toHaveLength(requestsBeforeRetry + 1);
  expect(
    api.standingsRequests.every((request) => request === '/api/v1/standings'),
  ).toBe(true);
  expect(api.unexpectedRequests).toEqual([]);
});

test('em 375 px evita overflow da página e mantém a rolagem dentro da tabela', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await mockApi(page, { standings, matches: recentMatches });
  await openStandings(page);

  const table = page.getByRole('table', { name: 'Classificação dos clubes' });
  await expect(table.locator('tbody > tr')).toHaveCount(6);
  await expectNoHorizontalPageOverflow(page);

  const tableContainer = table.locator('xpath=..');
  const scrollMetrics = await tableContainer.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(scrollMetrics.scroll).toBeGreaterThan(scrollMetrics.client);
  expect(scrollMetrics.overflowX).toBe('auto');
  expect(api.unexpectedRequests).toEqual([]);
});
