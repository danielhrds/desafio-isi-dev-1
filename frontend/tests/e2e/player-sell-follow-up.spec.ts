import { expect, test, type Page } from '@playwright/test';
import type {
  ClubDetail,
  ClubLineup,
  ClubRosterPlayer,
  ClubSummary,
} from '../../src/types/club';
import type { SellPlayerResult } from '../../src/types/market';
import type {
  PlayerDetail,
  PlayerListItem,
  PlayerListResponse,
} from '../../src/types/player';
import type { ClubTransactionsResponse } from '../../src/types/transaction';

const clubId = 1;
const soldPlayerId = 7;
const clubName = 'Águias FC';
const soldPlayerName = 'Meia Lua';

const players: PlayerDetail[] = [
  {
    id: 8,
    name: 'Guto Guarda',
    position: 'GOL',
    overall: 72,
    agility: 64,
    age: 29,
    condition: 'APTO',
    base_value: 30,
    market_value: 32,
    club_id: clubId,
    pace: 61,
    shooting: 42,
    passing: 55,
    dribbling: 50,
    defending: 70,
    physical: 75,
    potential: 78,
  },
  {
    id: 9,
    name: 'Zeca Nobre',
    position: 'ZAG',
    overall: 70,
    agility: 66,
    age: 27,
    condition: 'APTO',
    base_value: 28,
    market_value: 29,
    club_id: clubId,
    pace: 62,
    shooting: 40,
    passing: 60,
    dribbling: 55,
    defending: 74,
    physical: 72,
    potential: 75,
  },
  {
    id: 10,
    name: 'Léo Lateral',
    position: 'LAT',
    overall: 73,
    agility: 76,
    age: 25,
    condition: 'APTO',
    base_value: 34,
    market_value: 35,
    club_id: clubId,
    pace: 78,
    shooting: 55,
    passing: 70,
    dribbling: 68,
    defending: 69,
    physical: 68,
    potential: 80,
  },
  {
    id: soldPlayerId,
    name: soldPlayerName,
    position: 'MEI',
    overall: 78,
    agility: 76,
    age: 26,
    condition: 'APTO',
    base_value: 70,
    market_value: 75,
    club_id: clubId,
    pace: 72,
    shooting: 68,
    passing: 82,
    dribbling: 79,
    defending: 55,
    physical: 70,
    potential: 88,
  },
  {
    id: 11,
    name: 'Paco Verde',
    position: 'ATA',
    overall: 74,
    agility: 79,
    age: 24,
    condition: 'APTO',
    base_value: 26,
    market_value: 27,
    club_id: clubId,
    pace: 81,
    shooting: 77,
    passing: 58,
    dribbling: 75,
    defending: 38,
    physical: 65,
    potential: 84,
  },
];

function rosterPlayer(player: PlayerDetail): ClubRosterPlayer {
  return {
    ...player,
    club_id: clubId,
    contract: {
      purchase_value: player.id === soldPlayerId ? 60 : 25,
      loyalty_until: '2027-03-02T10:15:00-03:00',
      remaining_days: player.id === soldPlayerId ? 200 : 120,
      penalty_rate: player.id === soldPlayerId ? 20 : 10,
    },
  };
}

const roster = players.map(rosterPlayer);
const remainingRoster = roster.filter((player) => player.id !== soldPlayerId);

const clubBeforeSale: ClubDetail = {
  id: clubId,
  name: clubName,
  acronym: 'AGU',
  cash: 300,
  squad_value: 198,
  net_worth: 498,
  players: roster,
};

const clubAfterSale: ClubDetail = {
  id: clubId,
  name: clubName,
  acronym: 'AGU',
  cash: 363,
  squad_value: 123,
  net_worth: 486,
  players: remainingRoster,
};

function toClubSummary(club: ClubDetail): ClubSummary {
  return {
    id: club.id,
    name: club.name,
    acronym: club.acronym,
    cash: club.cash,
    squad_value: club.squad_value,
    net_worth: club.net_worth,
  };
}

const summaries = [toClubSummary(clubBeforeSale)];
const updatedSummaries = [toClubSummary(clubAfterSale)];

const lineupBeforeSale: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: true,
  players,
};

const lineupAfterSale: ClubLineup = {
  club_id: clubId,
  formation: '2-1-1',
  complete: false,
  players: players.filter((player) => player.id !== soldPlayerId),
};

const saleResult: SellPlayerResult = {
  id: 31,
  club_id: clubId,
  player_id: soldPlayerId,
  player_name: soldPlayerName,
  type: 'VENDA',
  value: 75,
  fee: 2,
  penalty: 10,
  profit: 15,
  cash_change: 63,
  created_at: '2026-10-22T16:40:00-03:00',
  purchase_value: 60,
  remaining_days: 200,
  penalty_rate: 20,
  contract_status: 'RESCINDIDO',
  club_cash: 363,
};

const transactionsBeforeSale: ClubTransactionsResponse = {
  data: [],
  summary: {
    total_spent: 0,
    total_received: 0,
    total_fees: 0,
    total_penalties: 0,
    total_profit: 0,
  },
};

const transactionsAfterSale: ClubTransactionsResponse = {
  data: [
    {
      id: saleResult.id,
      club_id: clubId,
      player_id: soldPlayerId,
      player_name: soldPlayerName,
      type: 'VENDA',
      value: 75,
      fee: 2,
      penalty: 10,
      profit: 15,
      cash_change: 63,
      created_at: saleResult.created_at,
    },
  ],
  summary: {
    total_spent: 0,
    total_received: 63,
    total_fees: 2,
    total_penalties: 10,
    total_profit: 15,
  },
};

interface SaleApiState {
  sold: boolean;
  saleRequests: Array<{ method: string; body: string | null }>;
  unexpectedRequests: string[];
  reads: {
    clubs: string[];
    clubDetail: string[];
    lineup: string[];
    transactions: string[];
    players: string[];
  };
  completed: {
    clubs: string[];
    clubDetail: string[];
    lineup: string[];
    transactions: string[];
    players: string[];
  };
}

function playerListItem(player: PlayerDetail, sold: boolean): PlayerListItem {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    overall: player.overall,
    agility: player.agility,
    age: player.age,
    condition: player.condition,
    base_value: player.base_value,
    market_value: player.market_value,
    club_id: sold && player.id === soldPlayerId ? null : clubId,
  };
}

function getPlayerListResponse(url: URL, sold: boolean): PlayerListResponse {
  let data = players.map((player) => playerListItem(player, sold));
  const freeFilter = url.searchParams.get('free');

  if (freeFilter === 'true') {
    data = data.filter((player) => player.club_id === null);
  } else if (freeFilter === 'false') {
    data = data.filter((player) => player.club_id !== null);
  }

  const requestedClubId = url.searchParams.get('club_id');
  if (requestedClubId) {
    data = data.filter((player) => player.club_id === Number(requestedClubId));
  }

  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Number(url.searchParams.get('limit') ?? '10');
  const totalItems = data.length;

  return {
    data: data.slice((page - 1) * limit, page * limit),
    meta: {
      page,
      limit,
      total_items: totalItems,
      total_pages: totalItems === 0 ? 0 : Math.ceil(totalItems / limit),
    },
  };
}

async function mockSaleApi(page: Page): Promise<SaleApiState> {
  const api: SaleApiState = {
    sold: false,
    saleRequests: [],
    unexpectedRequests: [],
    reads: {
      clubs: [],
      clubDetail: [],
      lineup: [],
      transactions: [],
      players: [],
    },
    completed: {
      clubs: [],
      clubDetail: [],
      lineup: [],
      transactions: [],
      players: [],
    },
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === 'POST' &&
      url.pathname === `/api/v1/players/${soldPlayerId}/sell`
    ) {
      api.saleRequests.push({
        method: request.method(),
        body: request.postData(),
      });
      api.sold = true;
      await route.fulfill({ json: saleResult });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      api.reads.players.push(url.search);
      await route.fulfill({ json: getPlayerListResponse(url, api.sold) });
      api.completed.players.push(url.search);
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      api.reads.clubs.push(url.search);
      await route.fulfill({
        json: api.sold ? updatedSummaries : summaries,
      });
      api.completed.clubs.push(url.search);
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}`
    ) {
      api.reads.clubDetail.push(url.search);
      await route.fulfill({
        json: api.sold ? clubAfterSale : clubBeforeSale,
      });
      api.completed.clubDetail.push(url.search);
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}/lineup`
    ) {
      api.reads.lineup.push(url.search);
      await route.fulfill({
        json: api.sold ? lineupAfterSale : lineupBeforeSale,
      });
      api.completed.lineup.push(url.search);
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${clubId}/transactions`
    ) {
      api.reads.transactions.push(url.search);
      await route.fulfill({
        json: api.sold ? transactionsAfterSale : transactionsBeforeSale,
      });
      api.completed.transactions.push(url.search);
      return;
    }

    api.unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route' },
    });
  });

  return api;
}

function countPlayerPageReads(reads: string[]) {
  return reads.filter(
    (query) => new URLSearchParams(query).get('limit') !== '1',
  ).length;
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

async function expectHistoryTableScrollsInside(page: Page) {
  const historyRegion = page.getByRole('region', {
    name: 'Tabela e resumo do histórico de transações',
  });
  const size = await historyRegion.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(size.width).toBeLessThanOrEqual(375);
  expect(size.scrollWidth).toBeGreaterThan(size.width);
  expect(size.overflowX).toMatch(/auto|scroll/);
  await historyRegion.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await historyRegion.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
}

async function expectPlayerTableScrollsInside(page: Page) {
  const table = page.getByRole('table', { name: 'Jogadores' });
  const container = page
    .locator('[data-slot="table-container"]')
    .filter({ has: table });
  const size = await container.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(size.width).toBeLessThanOrEqual(375);
  expect(size.scrollWidth).toBeGreaterThan(size.width);
  expect(size.overflowX).toMatch(/auto|scroll/);
}

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

for (const viewport of viewports) {
  test(`venda de titular atualiza clube, escalação, histórico e jogadores sem reload em ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockSaleApi(page);
    let mainFrameNavigations = 0;
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        mainFrameNavigations += 1;
      }
    });

    await page.goto(`/clubes/${clubId}`);
    await expect(page.getByRole('heading', { name: clubName })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Vender ${soldPlayerName}` }),
    ).toBeVisible();
    await expect.poll(() => api.completed.clubs.length).toBeGreaterThan(0);
    await expect.poll(() => api.completed.clubDetail.length).toBeGreaterThan(0);
    await expect.poll(() => api.completed.lineup.length).toBeGreaterThan(0);
    await expect
      .poll(() => api.completed.transactions.length)
      .toBeGreaterThan(0);
    await expect
      .poll(() => countPlayerPageReads(api.completed.players))
      .toBeGreaterThan(0);
    const initialNavigationCount = mainFrameNavigations;
    const initialCounts = {
      clubs: api.completed.clubs.length,
      clubDetail: api.completed.clubDetail.length,
      lineup: api.completed.lineup.length,
      transactions: api.completed.transactions.length,
      playerPages: countPlayerPageReads(api.completed.players),
    };

    const financialSummary = page.getByRole('region', {
      name: 'Resumo financeiro e do elenco',
    });
    await expect(
      financialSummary
        .getByText('Caixa', { exact: true })
        .locator('xpath=ancestor::*[@data-slot="card"]'),
    ).toContainText('300,00');
    await expect(
      financialSummary
        .getByText('Valor do elenco', { exact: true })
        .locator('xpath=ancestor::*[@data-slot="card"]'),
    ).toContainText('198,00');
    await expect(
      financialSummary
        .getByText('Patrimônio', { exact: true })
        .locator('xpath=ancestor::*[@data-slot="card"]'),
    ).toContainText('498,00');

    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page, viewport.width);
    }

    await page
      .getByRole('button', { name: `Vender ${soldPlayerName}` })
      .click();
    const confirmation = page.getByRole('dialog', {
      name: `Vender ${soldPlayerName}?`,
    });
    await expect(confirmation).toBeVisible();
    await expect(
      confirmation.getByText(`${soldPlayerName} é titular`, { exact: true }),
    ).toBeVisible();
    await expect(
      confirmation.getByRole('button', { name: 'Confirmar venda' }),
    ).toBeEnabled();

    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page, viewport.width);
    }

    await confirmation.getByRole('button', { name: 'Confirmar venda' }).click();
    const result = page.getByRole('dialog', { name: 'Venda concluída' });
    await expect(result).toBeVisible();
    await expect(
      result.getByText(
        `${soldPlayerName} voltou a ficar livre e saiu da escalação.`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect
      .poll(() => api.completed.clubs.length)
      .toBeGreaterThan(initialCounts.clubs);
    await expect
      .poll(() => api.completed.clubDetail.length)
      .toBeGreaterThan(initialCounts.clubDetail);
    await expect
      .poll(() => api.completed.lineup.length)
      .toBeGreaterThan(initialCounts.lineup);
    await expect
      .poll(() => api.completed.transactions.length)
      .toBeGreaterThan(initialCounts.transactions);
    await expect
      .poll(() => countPlayerPageReads(api.completed.players))
      .toBeGreaterThan(initialCounts.playerPages);
    expect(api.saleRequests).toEqual([{ method: 'POST', body: null }]);

    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page, viewport.width);
    }

    await result.getByRole('button', { name: 'Ver histórico' }).click();
    await expect(result).not.toBeVisible();
    const updatedFinancialSummary = page.getByRole('region', {
      name: 'Resumo financeiro e do elenco',
    });
    await expect(
      updatedFinancialSummary
        .getByText('Caixa', { exact: true })
        .locator('xpath=ancestor::*[@data-slot="card"]'),
    ).toContainText('363,00');
    await expect(
      updatedFinancialSummary
        .getByText('Valor do elenco', { exact: true })
        .locator('xpath=ancestor::*[@data-slot="card"]'),
    ).toContainText('123,00');
    await expect(
      updatedFinancialSummary
        .getByText('Patrimônio', { exact: true })
        .locator('xpath=ancestor::*[@data-slot="card"]'),
    ).toContainText('486,00');
    await expect(
      page.getByText('4 de 12 jogadores', { exact: true }),
    ).toBeVisible();

    const history = page.getByRole('region', {
      name: 'Tabela e resumo do histórico de transações',
    });
    const transactionRow = page
      .getByRole('table', { name: 'Histórico de transações do clube' })
      .getByRole('row')
      .filter({ hasText: soldPlayerName });
    await expect(transactionRow).toBeVisible();
    await expect(transactionRow.getByText('22/10/2026')).toBeVisible();
    await expect(transactionRow.getByText('16:40')).toBeVisible();
    await expect(
      transactionRow.getByText('Venda', { exact: true }),
    ).toBeVisible();
    await expect(
      transactionRow.getByText('75,00', { exact: true }),
    ).toBeVisible();
    await expect(
      transactionRow.getByText('2,00', { exact: true }),
    ).toBeVisible();
    await expect(
      transactionRow.getByText('10,00', { exact: true }),
    ).toBeVisible();
    await expect(
      transactionRow.getByText('+ 15,00', { exact: true }),
    ).toBeVisible();
    await expect(
      transactionRow.getByText('+ 63,00', { exact: true }),
    ).toBeVisible();

    const transactionSummary = history.locator(
      '[aria-label="Resumo das transações"]',
    );
    const summaryValue = (label: string) =>
      transactionSummary
        .getByText(label, { exact: true })
        .locator('xpath=..')
        .locator('xpath=following-sibling::p[1]');
    await expect(summaryValue('Total pago em compras')).toHaveText('0,00');
    await expect(summaryValue('Total recebido em vendas')).toHaveText('63,00');
    await expect(summaryValue('Taxas e comissões')).toHaveText('2,00');
    await expect(summaryValue('Multas')).toHaveText('10,00');
    await expect(summaryValue('Lucro total')).toHaveText('+ 15,00');

    if (viewport.width === 375) {
      await expectHistoryTableScrollsInside(page);
      await expectNoHorizontalPageOverflow(page, viewport.width);
    }

    await page.getByRole('tab', { name: 'Escalação' }).click();
    const lineupPanel = page.getByRole('tabpanel');
    await expect(
      lineupPanel.getByText(
        `Escalação incompleta: ${clubName} não pode jogar partidas`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      lineupPanel.getByRole('img', { name: 'Vaga de Meio vazia' }),
    ).toBeVisible();
    await expect(
      lineupPanel.getByText(soldPlayerName, { exact: true }),
    ).toHaveCount(0);

    if (viewport.width === 375) {
      await expectNoHorizontalPageOverflow(page, viewport.width);
    }

    await page.getByRole('link', { name: 'Comprar jogadores' }).click();
    await expect(
      page.getByRole('heading', { name: 'Jogadores' }),
    ).toBeVisible();
    const playerTable = page.getByRole('table', { name: 'Jogadores' });
    const soldPlayerRow = playerTable
      .getByRole('row')
      .filter({ hasText: soldPlayerName });
    await expect(soldPlayerRow).toBeVisible();
    await expect(
      soldPlayerRow.getByText('Livre', { exact: true }),
    ).toBeVisible();
    expect(api.unexpectedRequests).toEqual([]);
    expect(mainFrameNavigations).toBe(initialNavigationCount);

    if (viewport.width === 375) {
      await expectPlayerTableScrollsInside(page);
      await expectNoHorizontalPageOverflow(page, viewport.width);
    }
  });
}
