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

const attackLabels = {
  shooting: 'Finalização',
  passing: 'Passe',
  dribbling: 'Drible',
  defending: 'Defesa',
} as const;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function mockApi(page: Page, options?: { holdFirstDetail?: boolean }) {
  const detailRequests: string[] = [];
  const unexpectedRequests: string[] = [];
  const firstDetailGate = deferred();
  const holdFirstDetail = options?.holdFirstDetail ?? false;
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
      await route.fulfill({ json: [matchSummary] });
      return;
    }

    if (
      request.method() === 'GET' &&
      /^\/api\/v1\/matches\/\d+$/.test(url.pathname)
    ) {
      detailRequests.push(`${url.pathname}${url.search}`);
      if (holdFirstDetail && detailRequests.length === 1) {
        await firstDetailGate.promise;
      }

      if (url.pathname === '/api/v1/matches/999') {
        await route.fulfill({
          status: 404,
          json: { message: 'A partida 999 não foi encontrada.' },
        });
        return;
      }

      if (holdFirstDetail && !retryAllowed) {
        await route.fulfill({
          status: 503,
          json: { message: 'Falha ao carregar os detalhes da partida.' },
        });
        return;
      }

      await route.fulfill({ json: match });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    detailRequests,
    unexpectedRequests,
    releaseFirstDetail() {
      firstDetailGate.resolve();
    },
    allowRetry() {
      retryAllowed = true;
    },
  };
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

test('carrega o detalhe pela API e mostra os dados dos seis duelos sem recalcular', async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto(`/partidas/${match.id}`);

  await expect(
    page.getByRole('table', { name: 'Seis duelos da partida' }),
  ).toBeVisible();
  await expect(page.getByText('2 × 1', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Vitória do mandante', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('11/11/2026, 20:00')).toBeVisible();
  await expect(
    page.getByRole('group', {
      name: 'Campo: Aurora FC contra Delta FC',
    }),
  ).toBeVisible();

  const duelsTable = page.getByRole('table', {
    name: 'Seis duelos da partida',
  });
  const rows = duelsTable.locator('tbody > tr');
  await expect(rows).toHaveCount(8);
  for (const duelData of match.duels) {
    const row = rows.nth(duelData.order + (duelData.order > 3 ? 1 : 0));
    await expect(row).toContainText(duelData.attacker.player_name);
    await expect(row).toContainText(duelData.attacker.position);
    await expect(row).toContainText(attackLabels[duelData.attacker.attribute]);
    await expect(row).toContainText(String(duelData.attacker.value));
    await expect(row).toContainText(duelData.defender.player_name);
    await expect(row).toContainText(duelData.defender.position);
    await expect(row).toContainText(attackLabels[duelData.defender.attribute]);
    await expect(row).toContainText(String(duelData.defender.value));
    await expect(row).toContainText(duelData.goal ? 'Gol' : 'Sem gol');
    if (
      duelData.attacker.condition === 'MAL_CONDICIONADO' ||
      duelData.defender.condition === 'MAL_CONDICIONADO'
    ) {
      await expect(row).toContainText('Mal condicionado');
    }
  }

  await expect(
    page.getByRole('group', {
      name: 'Gabriel Antunes, ATA, Fin 81, marcou gol',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', {
      name: 'Kauã Ribeiro, LAT, Drible 75, mal condicionado, marcou gol',
    }),
  ).toBeVisible();
  expect(api.detailRequests).toEqual([`/api/v1/matches/${match.id}`]);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mostra carregamento, mensagem da API e tenta novamente o GET do detalhe', async ({
  page,
}) => {
  const api = await mockApi(page, { holdFirstDetail: true });
  await page.goto(`/partidas/${match.id}`);

  await expect(
    page.getByRole('status', { name: 'Carregando partida' }),
  ).toBeVisible();
  expect(api.detailRequests).toEqual([`/api/v1/matches/${match.id}`]);

  api.releaseFirstDetail();
  await expect(
    page.getByText('Não foi possível carregar a partida', { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText('Falha ao carregar os detalhes da partida.', {
      exact: true,
    }),
  ).toBeVisible();
  const requestsBeforeRetry = api.detailRequests.length;

  api.allowRetry();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('table', { name: 'Seis duelos da partida' }),
  ).toBeVisible();
  expect(api.detailRequests).toHaveLength(requestsBeforeRetry + 1);
  expect(
    api.detailRequests.every(
      (request) => request === `/api/v1/matches/${match.id}`,
    ),
  ).toBe(true);
  expect(api.unexpectedRequests).toEqual([]);
});

test('mostra a mensagem de 404 e não consulta a API para um identificador inválido', async ({
  page,
}) => {
  const api = await mockApi(page);
  await page.goto('/partidas/999');

  await expect(
    page.getByText('A partida 999 não foi encontrada.', { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('link', { name: 'Voltar para partidas' }),
  ).toBeVisible();
  expect(api.detailRequests.length).toBeGreaterThan(0);
  expect(
    api.detailRequests.every((request) => request === '/api/v1/matches/999'),
  ).toBe(true);

  await page.getByRole('link', { name: 'Voltar para partidas' }).click();
  await expect(page).toHaveURL(/\/partidas$/);
  await expect(
    page.getByRole('table', { name: 'Histórico de partidas' }),
  ).toBeVisible();

  const requestsBeforeInvalidId = api.detailRequests.length;
  await page.goto('/partidas/abc');
  await expect(
    page.getByText('O identificador da partida é inválido.', { exact: true }),
  ).toBeVisible();
  expect(api.detailRequests).toHaveLength(requestsBeforeInvalidId);
  expect(api.unexpectedRequests).toEqual([]);
});

test('em 375 px mantém a página sem overflow e o campo e a tabela com rolagem interna', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const api = await mockApi(page);
  await page.goto(`/partidas/${match.id}`);

  const duelsTable = page.getByRole('table', {
    name: 'Seis duelos da partida',
  });
  await expect(duelsTable).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Voltar para partidas' }),
  ).toBeVisible();
  await expectNoHorizontalPageOverflow(page);

  const field = page.getByRole('region', {
    name: 'Campo da partida; use rolagem horizontal para ver toda a formação',
  });
  const fieldMetrics = await field.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(fieldMetrics.scroll).toBeGreaterThan(fieldMetrics.client);
  expect(fieldMetrics.overflowX).toBe('auto');

  const tableContainer = duelsTable.locator('xpath=..');
  const tableMetrics = await tableContainer.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(tableMetrics.scroll).toBeGreaterThan(tableMetrics.client);
  expect(tableMetrics.overflowX).toBe('auto');
  expect(api.detailRequests).toEqual([`/api/v1/matches/${match.id}`]);
  expect(api.unexpectedRequests).toEqual([]);
});
