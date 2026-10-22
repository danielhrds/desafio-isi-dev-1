import { expect, test, type Page } from '@playwright/test';
import type { ClubSummary } from '../../src/types/club';
import type { MatchSummary } from '../../src/types/match';

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

const newestMatch: MatchSummary = {
  id: 75,
  played_at: '2026-11-12T00:30:00Z',
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
};

const olderMatch: MatchSummary = {
  id: 74,
  played_at: '2026-11-11T20:00:00-03:00',
  home: {
    club_id: 3,
    club_name: 'Gama SC',
    formation: '2-1-1',
    goals: 0,
  },
  away: {
    club_id: 1,
    club_name: 'Aurora FC',
    formation: '2-1-1',
    goals: 1,
  },
  result: 'VISITANTE',
};

type MatchListReply = (clubId: string | null) => MatchSummary[];

async function mockApi(
  page: Page,
  listReply: MatchListReply,
  onMatchListRequest?: (url: URL) => Promise<void> | void,
) {
  const matchRequests: string[] = [];
  const unexpectedRequests: string[] = [];

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
      matchRequests.push(`${url.pathname}${url.search}`);
      await onMatchListRequest?.(url);
      await route.fulfill({ json: listReply(url.searchParams.get('club_id')) });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return { matchRequests, unexpectedRequests };
}

async function openMatchHistory(page: Page) {
  await page.goto('/partidas');
  await expect(
    page.getByRole('heading', { name: 'Partidas', exact: true }),
  ).toBeVisible();
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

test('exibe as partidas na ordem recebida, com data de Brasília e última partida', async ({
  page,
}) => {
  const api = await mockApi(page, () => [newestMatch, olderMatch]);
  await openMatchHistory(page);

  const table = page.getByRole('table', { name: 'Histórico de partidas' });
  const rows = table.locator('tbody > tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('11/11/2026, 21:30');
  await expect(rows.nth(0)).toContainText('Aurora FC');
  await expect(rows.nth(0)).toContainText('2 × 1');
  await expect(rows.nth(0)).toContainText('Delta FC');
  await expect(rows.nth(0)).toContainText('Vitória do mandante');
  await expect(rows.nth(1)).toContainText('11/11/2026, 20:00');
  await expect(rows.nth(1)).toContainText('Gama SC');
  await expect(rows.nth(1)).toContainText('0 × 1');
  await expect(rows.nth(1)).toContainText('Vitória do visitante');
  await expect(page.getByText('2 partidas', { exact: true })).toBeVisible();

  const latest = page.locator(
    'section[aria-labelledby="latest-match-heading"]',
  );
  await expect(latest).toContainText('Aurora FC');
  await expect(latest).toContainText('Delta FC');
  await expect(latest).toContainText('2 × 1');
  await expect(latest).toContainText('11/11/2026, 21:30');
  expect(api.matchRequests).toEqual(['/api/v1/matches']);
  expect(api.unexpectedRequests).toEqual([]);
});

test('envia o filtro por clube à API e preserva o card da última partida global', async ({
  page,
}) => {
  const api = await mockApi(page, (clubId) =>
    clubId === '1' ? [olderMatch] : [newestMatch, olderMatch],
  );
  await openMatchHistory(page);
  await expect(
    page.getByRole('table', { name: 'Histórico de partidas' }),
  ).toBeVisible();

  await page
    .getByRole('combobox', { name: 'Filtrar partidas por clube' })
    .click();
  await page.getByRole('option', { name: 'Aurora FC', exact: true }).click();

  const table = page.getByRole('table', { name: 'Histórico de partidas' });
  const rows = table.locator('tbody > tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Gama SC');
  await expect(rows.first()).toContainText('Aurora FC');
  await expect(rows.first()).toContainText('0 × 1');
  await expect(page.getByText('1 partida', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Filtrar partidas por clube' }),
  ).toContainText('Aurora FC');

  const latest = page.locator(
    'section[aria-labelledby="latest-match-heading"]',
  );
  await expect(latest).toContainText('Aurora FC');
  await expect(latest).toContainText('Delta FC');
  await expect(latest).toContainText('2 × 1');
  expect(api.matchRequests).toEqual([
    '/api/v1/matches',
    '/api/v1/matches?club_id=1',
  ]);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mantém o estado de carregamento até a resposta vazia da API', async ({
  page,
}) => {
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const api = await mockApi(
    page,
    () => [],
    async () => responseGate,
  );
  await openMatchHistory(page);

  await expect(
    page.getByRole('status', { name: 'Carregando partidas' }),
  ).toBeVisible();
  await expect(
    page.getByText('Nenhuma partida jogada', { exact: true }),
  ).toHaveCount(0);
  expect(api.matchRequests).toEqual(['/api/v1/matches']);

  releaseResponse();
  await expect(
    page.getByText('Nenhuma partida jogada', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Nova partida' }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Histórico de partidas' }),
  ).toHaveCount(0);
  await expect(
    page.locator('section[aria-labelledby="latest-match-heading"]'),
  ).toHaveCount(0);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mostra a mensagem exata da API e refaz a consulta ao pedir nova tentativa', async ({
  page,
}) => {
  let allowRetry = false;
  const matchRequests: string[] = [];
  const unexpectedRequests: string[] = [];
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
      matchRequests.push(`${url.pathname}${url.search}`);
      if (!allowRetry) {
        await route.fulfill({
          status: 503,
          json: { message: 'Falha ao carregar histórico da API.' },
        });
      } else {
        await route.fulfill({ json: [newestMatch, olderMatch] });
      }
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  await openMatchHistory(page);
  await expect(
    page.getByText('Não foi possível carregar as partidas', { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText('Falha ao carregar histórico da API.', { exact: true }),
  ).toBeVisible();
  const requestsBeforeRetry = matchRequests.length;
  expect(requestsBeforeRetry).toBeGreaterThan(0);

  allowRetry = true;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('table', { name: 'Histórico de partidas' }),
  ).toBeVisible();
  expect(matchRequests).toHaveLength(requestsBeforeRetry + 1);
  expect(matchRequests.every((request) => request === '/api/v1/matches')).toBe(
    true,
  );
  expect(unexpectedRequests).toEqual([]);
});

test('em 375 px não cria overflow na página e mantém a rolagem dentro da tabela', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await mockApi(page, () => [newestMatch, olderMatch]);
  await openMatchHistory(page);

  const table = page.getByRole('table', { name: 'Histórico de partidas' });
  await expect(table.locator('tbody > tr')).toHaveCount(2);
  await expectNoHorizontalPageOverflow(page);

  const tableContainer = table.locator('xpath=..');
  const scrollMetrics = await tableContainer.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(scrollMetrics.scroll).toBeGreaterThan(scrollMetrics.client);
  expect(scrollMetrics.overflowX).toBe('auto');
  await expect(
    page.getByRole('combobox', { name: 'Filtrar partidas por clube' }),
  ).toBeVisible();
  expect(api.unexpectedRequests).toEqual([]);
});
