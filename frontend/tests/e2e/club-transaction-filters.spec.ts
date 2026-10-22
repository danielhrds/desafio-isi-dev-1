import { expect, test, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { ClubDetail, ClubLineup, ClubSummary } from '../../src/types/club';
import type { PlayerListResponse } from '../../src/types/player';
import type {
  ClubTransaction,
  ClubTransactionsResponse,
} from '../../src/types/transaction';

const club: ClubDetail = {
  id: 1,
  name: 'Aguias FC',
  acronym: 'AGU',
  cash: 300,
  squad_value: 0,
  net_worth: 300,
  players: [],
};

const clubSummary: ClubSummary = {
  id: club.id,
  name: club.name,
  acronym: club.acronym,
  cash: club.cash,
  squad_value: club.squad_value,
  net_worth: club.net_worth,
};

const lineup: ClubLineup = {
  club_id: club.id,
  formation: null,
  complete: false,
  players: [],
};

const players: PlayerListResponse = {
  data: [],
  meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
};

const purchaseBia: ClubTransaction = {
  id: 201,
  club_id: club.id,
  player_id: 7,
  player_name: 'Bia Nogueira',
  type: 'COMPRA',
  value: 44.2,
  fee: 2.21,
  penalty: 0,
  profit: null,
  cash_change: -46.41,
  created_at: '2026-09-19T01:30:00.000Z',
};

const saleBia: ClubTransaction = {
  id: 202,
  club_id: club.id,
  player_id: 7,
  player_name: 'Bia Nogueira',
  type: 'VENDA',
  value: 59.8,
  fee: 1.48,
  penalty: 4.16,
  profit: 15.6,
  cash_change: 54.16,
  created_at: '2026-09-19T02:15:00.000Z',
};

const saleNando: ClubTransaction = {
  id: 203,
  club_id: club.id,
  player_id: 8,
  player_name: 'Nando Lira',
  type: 'VENDA',
  value: 30,
  fee: 0.75,
  penalty: 0.75,
  profit: -4,
  cash_change: 28.5,
  created_at: '2026-09-18T21:15:00-03:00',
};

const purchaseGuto: ClubTransaction = {
  id: 204,
  club_id: club.id,
  player_id: 4,
  player_name: 'Guto Prado',
  type: 'COMPRA',
  value: 20,
  fee: 0,
  penalty: 0,
  profit: null,
  cash_change: -20,
  created_at: '2026-09-18T16:30:00-03:00',
};

const allTransactions: ClubTransactionsResponse = {
  data: [saleBia, purchaseBia, saleNando, purchaseGuto],
  summary: {
    total_spent: 66.41,
    total_received: 82.66,
    total_fees: 4.44,
    total_penalties: 4.91,
    total_profit: 11.6,
  },
};

const sales: ClubTransactionsResponse = {
  data: [saleBia, saleNando],
  summary: {
    total_spent: 0,
    total_received: 82.66,
    total_fees: 2.23,
    total_penalties: 4.91,
    total_profit: 11.6,
  },
};

const nandoSale: ClubTransactionsResponse = {
  data: [saleNando],
  summary: {
    total_spent: 0,
    total_received: 28.5,
    total_fees: 0.75,
    total_penalties: 0.75,
    total_profit: -4,
  },
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

const exportFilename = 'club-1-transactions.csv';
const exportCsv =
  'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa\n' +
  '2026-09-18T21:15:00-03:00;VENDA;Nando Lira;30,00;0,75;0,75;-4,00;28,50\n';

const deletedPlayerMessage = 'Jogador não encontrado.';

interface TransactionRead {
  type: string | null;
  playerId: string | null;
}

interface TransactionExportRead extends TransactionRead {
  method: string;
  body: string | null;
}

type TransactionRouteHandler = (
  route: Route,
  requestNumber: number,
) => Promise<boolean>;
type ExportRouteHandler = TransactionRouteHandler;

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

async function mockClubApi(
  page: Page,
  transactionRouteHandler?: TransactionRouteHandler,
  exportRouteHandler?: ExportRouteHandler,
) {
  const transactionReads: TransactionRead[] = [];
  const transactionExports: TransactionExportRead[] = [];
  const unexpectedRequests: string[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      await route.fulfill({ json: players });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({ json: [clubSummary] });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}`
    ) {
      await route.fulfill({ json: club });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}/lineup`
    ) {
      await route.fulfill({ json: lineup });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}/transactions/export`
    ) {
      const type = url.searchParams.get('type');
      const playerId = url.searchParams.get('player_id');
      transactionExports.push({
        type,
        playerId,
        method: request.method(),
        body: request.postData(),
      });

      if (
        exportRouteHandler &&
        (await exportRouteHandler(route, transactionExports.length))
      ) {
        return;
      }

      unexpectedRequests.push(
        `${request.method()} ${url.pathname}${url.search}`,
      );
      await route.fulfill({
        status: 404,
        json: { message: 'Unexpected API route' },
      });
      return;
    }

    if (
      request.method() === 'GET' &&
      url.pathname === `/api/v1/clubs/${club.id}/transactions`
    ) {
      const type = url.searchParams.get('type');
      const playerId = url.searchParams.get('player_id');
      transactionReads.push({ type, playerId });

      if (
        transactionRouteHandler &&
        (await transactionRouteHandler(route, transactionReads.length))
      ) {
        return;
      }

      if (playerId === '4') {
        await route.fulfill({
          status: 404,
          json: { message: deletedPlayerMessage },
        });
        return;
      }

      if (type === 'VENDA' && playerId === '8') {
        await route.fulfill({ json: nandoSale });
        return;
      }

      if (type === 'VENDA') {
        await route.fulfill({ json: sales });
        return;
      }

      if (playerId === null && (type === null || type === 'COMPRA,VENDA')) {
        await route.fulfill({ json: allTransactions });
        return;
      }
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route' },
    });
  });

  return { transactionReads, transactionExports, unexpectedRequests };
}

async function openHistoryTab(page: Page) {
  await page.goto('/clubes/' + club.id);
  await expect(page.getByRole('heading', { name: club.name })).toBeVisible();
  await page.getByRole('tab').filter({ hasText: /Hist/ }).click();
}

async function openHistory(page: Page) {
  await page.goto(`/clubes/${club.id}`);
  await expect(page.getByRole('heading', { name: club.name })).toBeVisible();
  await page.getByRole('tab').filter({ hasText: /Hist/ }).click();

  const table = page.getByRole('table', { name: /Hist/ });
  await expect(table).toBeVisible();
  return table;
}

async function expectNoPageOverflow(page: Page, width: number) {
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

async function expectHistoryTableScrollInside(page: Page) {
  const region = page.getByRole('region', { name: /Tabela e resumo/ });
  const dimensions = await region.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(dimensions.width).toBeLessThanOrEqual(375);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
  expect(dimensions.overflowX).toMatch(/auto|scroll/);
  await region.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await region.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
}

async function expectHistoryLoadingScrollInside(page: Page) {
  const loading = page.getByRole('status', { name: 'Carregando histórico' });
  const dimensions = await loading.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(dimensions.width).toBeLessThanOrEqual(375);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
  expect(dimensions.overflowX).toMatch(/auto|scroll/);
  await loading.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await loading.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
}

async function expectTransactionSummary(
  page: Page,
  expected: readonly (readonly [string, string])[],
) {
  const summary = page
    .getByRole('region', { name: 'Tabela e resumo do histórico de transações' })
    .locator('[aria-label="Resumo das transações"]');

  for (const [label, value] of expected) {
    const item = summary
      .getByText(label, { exact: true })
      .locator('xpath=../..');
    await item.scrollIntoViewIfNeeded();
    await expect(item.getByText(value, { exact: true })).toBeVisible();
  }
}

for (const viewport of viewports) {
  test(`exibe transações da API e combina filtros de tipo e jogador em ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockClubApi(page);
    let documentNavigations = 0;
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentNavigations += 1;
      }
    });

    const table = await openHistory(page);
    const initialNavigationCount = documentNavigations;
    const rows = table.getByRole('row');
    await expect(rows).toHaveCount(5);
    expect(api.transactionReads).toContainEqual({
      type: 'COMPRA,VENDA',
      playerId: null,
    });

    const purchaseRow = rows
      .filter({ hasText: 'Bia Nogueira' })
      .filter({ hasText: 'Compra' });
    await expect(purchaseRow.getByRole('cell')).toHaveCount(8);
    await expect(purchaseRow.getByRole('cell').nth(0)).toContainText(
      '18/09/2026',
    );
    await expect(purchaseRow.getByRole('cell').nth(0)).toContainText('22:30');
    await expect(purchaseRow.getByRole('cell').nth(1)).toContainText('Compra');
    await expect(purchaseRow.getByRole('cell').nth(2)).toContainText('BN');
    await expect(purchaseRow.getByRole('cell').nth(3)).toContainText('44,20');
    await expect(purchaseRow.getByRole('cell').nth(4)).toContainText('2,21');
    await expect(purchaseRow.getByRole('cell').nth(5)).toContainText('0,00');
    await expect(purchaseRow.getByRole('cell').nth(6)).toContainText('\u2014');
    await expect(purchaseRow.getByRole('cell').nth(7)).toContainText('- 46,41');

    const nandoRow = rows
      .filter({ hasText: 'Nando Lira' })
      .filter({ hasText: 'Venda' });
    await expect(nandoRow.getByRole('cell').nth(0)).toContainText('21:15');
    await expect(nandoRow.getByRole('cell').nth(2)).toContainText('NL');
    await expect(nandoRow.getByRole('cell').nth(3)).toContainText('30,00');
    await expect(nandoRow.getByRole('cell').nth(4)).toContainText('0,75');
    await expect(nandoRow.getByRole('cell').nth(5)).toContainText('0,75');
    await expect(nandoRow.getByRole('cell').nth(6)).toContainText('- 4,00');
    await expect(nandoRow.getByRole('cell').nth(7)).toContainText('+ 28,50');

    await page.getByRole('button', { name: 'Filtrar por compra' }).click();
    await expect(
      page.getByRole('button', { name: 'Filtrar por compra' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: 'Compra' })).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Venda' })).toHaveCount(2);
    expect(api.transactionReads).toContainEqual({
      type: 'VENDA',
      playerId: null,
    });

    await page.getByRole('combobox', { name: 'Filtrar por jogador' }).click();
    await page.getByRole('option', { name: 'Nando Lira' }).click();
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Nando Lira' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Bia Nogueira' })).toHaveCount(0);
    expect(api.transactionReads).toContainEqual({
      type: 'VENDA',
      playerId: '8',
    });
    expect(api.unexpectedRequests).toEqual([]);
    expect(documentNavigations).toBe(initialNavigationCount);

    if (viewport.width === 375) {
      await expectHistoryTableScrollInside(page);
    }
    await expectNoPageOverflow(page, viewport.width);
  });
}

for (const viewport of viewports) {
  test(`mostra o message exato quando a API recusa jogador excluído em ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockClubApi(page);
    let documentNavigations = 0;
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentNavigations += 1;
      }
    });

    const table = await openHistory(page);
    const initialNavigationCount = documentNavigations;
    await expect(table.getByRole('row')).toHaveCount(5);
    await page.getByRole('combobox', { name: 'Filtrar por jogador' }).click();
    await page.getByRole('option', { name: 'Guto Prado' }).click();

    await expect(
      page.getByText(deletedPlayerMessage, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('O filtro foi recusado.', { exact: true }),
    ).toBeVisible();
    expect(api.transactionReads).toContainEqual({
      type: 'COMPRA,VENDA',
      playerId: '4',
    });
    expect(api.unexpectedRequests).toEqual([]);
    expect(documentNavigations).toBe(initialNavigationCount);
    await expectNoPageOverflow(page, viewport.width);
  });
}

for (const viewport of viewports) {
  test(
    'mostra os totais do summary da API após aplicar filtros em ' +
      viewport.label,
    async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const api = await mockClubApi(page);

      await openHistory(page);
      await expectTransactionSummary(page, [
        ['Total pago em compras', '66,41'],
        ['Total recebido em vendas', '82,66'],
        ['Taxas e comissões', '4,44'],
        ['Multas', '4,91'],
        ['Lucro total', '+ 11,60'],
      ]);

      await page.getByRole('button', { name: 'Filtrar por compra' }).click();
      await expectTransactionSummary(page, [
        ['Total pago em compras', '0,00'],
        ['Total recebido em vendas', '82,66'],
        ['Taxas e comissões', '2,23'],
        ['Multas', '4,91'],
        ['Lucro total', '+ 11,60'],
      ]);
      expect(api.transactionReads).toContainEqual({
        type: 'VENDA',
        playerId: null,
      });

      await page.getByRole('combobox', { name: 'Filtrar por jogador' }).click();
      await page.getByRole('option', { name: 'Nando Lira' }).click();
      await expectTransactionSummary(page, [
        ['Total pago em compras', '0,00'],
        ['Total recebido em vendas', '28,50'],
        ['Taxas e comissões', '0,75'],
        ['Multas', '0,75'],
        ['Lucro total', '- 4,00'],
      ]);
      expect(api.transactionReads).toContainEqual({
        type: 'VENDA',
        playerId: '8',
      });
      expect(api.unexpectedRequests).toEqual([]);

      if (viewport.width === 375) {
        await expectHistoryTableScrollInside(page);
      }
      await expectNoPageOverflow(page, viewport.width);
    },
  );
}

for (const viewport of viewports) {
  test(
    'mantém o carregamento do histórico acessível em ' + viewport.label,
    async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      let releaseTransactions!: () => void;
      let notifyTransactionRequest!: () => void;
      const pendingResponse = new Promise<void>((resolve) => {
        releaseTransactions = resolve;
      });
      const transactionRequestStarted = new Promise<void>((resolve) => {
        notifyTransactionRequest = resolve;
      });
      const api = await mockClubApi(page, async (route, requestNumber) => {
        if (requestNumber !== 1) {
          return false;
        }

        notifyTransactionRequest();
        await pendingResponse;
        await route.fulfill({ json: allTransactions });
        return true;
      });

      await openHistoryTab(page);
      await transactionRequestStarted;

      const loading = page.getByRole('status', {
        name: 'Carregando histórico',
      });
      try {
        await expect(loading).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Exportar CSV' }),
        ).toBeDisabled();
        await expect(
          page.getByRole('table', { name: /Hist/ }),
        ).not.toBeVisible();
        expect(api.transactionReads).toHaveLength(1);

        if (viewport.width === 375) {
          await expectHistoryLoadingScrollInside(page);
        }
        await expectNoPageOverflow(page, viewport.width);
      } finally {
        releaseTransactions();
      }

      const table = page.getByRole('table', { name: /Hist/ });
      await expect(table).toBeVisible();
      await expect(table.getByRole('row')).toHaveCount(5);
      expect(api.unexpectedRequests).toEqual([]);
      if (viewport.width === 375) {
        await expectHistoryTableScrollInside(page);
      }
      await expectNoPageOverflow(page, viewport.width);
    },
  );
}

for (const viewport of viewports) {
  test(
    'exibe o estado vazio do histórico em ' + viewport.label,
    async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const api = await mockClubApi(page, async (route) => {
        await route.fulfill({ json: emptyTransactions });
        return true;
      });

      await openHistoryTab(page);
      await expect(
        page.getByText('Nenhuma transação ainda', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          'As compras e vendas do clube aparecem aqui, com os totais logo abaixo.',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(page.getByRole('table', { name: /Hist/ })).not.toBeVisible();
      const historyRegion = page.getByRole('region', {
        name: 'Tabela e resumo do histórico de transações',
      });
      await expect(historyRegion).toBeVisible();
      await expectTransactionSummary(page, [
        ['Total pago em compras', '0,00'],
        ['Total recebido em vendas', '0,00'],
        ['Taxas e comissões', '0,00'],
        ['Multas', '0,00'],
        ['Lucro total', '0,00'],
      ]);
      expect(api.transactionReads.length).toBeGreaterThan(0);
      expect(api.unexpectedRequests).toEqual([]);

      if (viewport.width === 375) {
        await expectHistoryTableScrollInside(page);
      }
      await expectNoPageOverflow(page, viewport.width);
    },
  );
}

for (const viewport of viewports) {
  test(
    'permite recuperar o histórico após falha de rede em ' + viewport.label,
    async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      let retryAvailable = false;
      const api = await mockClubApi(page, async (route) => {
        if (!retryAvailable) {
          await route.abort('failed');
          return true;
        }

        await route.fulfill({ json: allTransactions });
        return true;
      });
      let documentNavigations = 0;
      page.on('request', (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          documentNavigations += 1;
        }
      });

      await openHistoryTab(page);
      const initialNavigationCount = documentNavigations;
      await expect(
        page.getByText('Não foi possível carregar o histórico', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText('Verifique a conexão e tente novamente.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Tentar novamente' }),
      ).toBeEnabled();
      expect(api.transactionReads.length).toBeGreaterThan(0);
      await expectNoPageOverflow(page, viewport.width);

      const failedRequestCount = api.transactionReads.length;
      retryAvailable = true;
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      const table = page.getByRole('table', { name: /Hist/ });
      await expect(table).toBeVisible();
      await expect(table.getByRole('row')).toHaveCount(5);
      expect(api.transactionReads).toHaveLength(failedRequestCount + 1);
      expect(api.unexpectedRequests).toEqual([]);
      expect(documentNavigations).toBe(initialNavigationCount);
      if (viewport.width === 375) {
        await expectHistoryTableScrollInside(page);
      }
      await expectNoPageOverflow(page, viewport.width);
    },
  );
}

for (const viewport of viewports) {
  test(
    'exporta o CSV da API com filtros, uma requisição e feedback de sucesso em ' +
      viewport.label,
    async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      let releaseExport!: () => void;
      let notifyExportRequest!: () => void;
      const pendingExport = new Promise<void>((resolve) => {
        releaseExport = resolve;
      });
      const exportRequestStarted = new Promise<void>((resolve) => {
        notifyExportRequest = resolve;
      });
      const api = await mockClubApi(page, undefined, async (route, number) => {
        if (number === 1) notifyExportRequest();
        await pendingExport;
        await route.fulfill({
          status: 200,
          body: exportCsv,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
          },
        });
        return true;
      });
      let documentNavigations = 0;
      page.on('request', (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          documentNavigations += 1;
        }
      });

      await openHistory(page);
      const initialNavigationCount = documentNavigations;
      await page.getByRole('button', { name: 'Filtrar por compra' }).click();
      await page.getByRole('combobox', { name: 'Filtrar por jogador' }).click();
      await page.getByRole('option', { name: 'Nando Lira' }).click();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar CSV' }).dblclick();
      await exportRequestStarted;
      try {
        await expect(
          page.getByRole('button', { name: 'Exportando…' }),
        ).toBeDisabled();
        expect(api.transactionExports).toEqual([
          {
            type: 'VENDA',
            playerId: '8',
            method: 'GET',
            body: null,
          },
        ]);
      } finally {
        releaseExport();
      }

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(exportFilename);
      const downloadedFile = await download.path();
      if (!downloadedFile) throw new Error('O arquivo CSV não foi salvo.');
      expect(await readFile(downloadedFile, 'utf8')).toBe(exportCsv);
      const toast = page.locator('[data-sonner-toast]');
      await expect(
        toast.getByText('CSV baixado', { exact: true }),
      ).toBeVisible();
      await expect(
        toast.getByText(`${exportFilename}, com os filtros aplicados.`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Exportar CSV' }),
      ).toBeEnabled();
      expect(api.transactionExports).toHaveLength(1);
      expect(api.unexpectedRequests).toEqual([]);
      expect(documentNavigations).toBe(initialNavigationCount);
      await expectNoPageOverflow(page, viewport.width);
    },
  );
}

for (const viewport of viewports) {
  test(
    'mostra o message exato da API quando a exportação é recusada em ' +
      viewport.label,
    async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const api = await mockClubApi(page, undefined, async (route) => {
        await route.fulfill({
          status: 404,
          json: { message: deletedPlayerMessage },
        });
        return true;
      });
      let documentNavigations = 0;
      let downloadCount = 0;
      page.on('request', (request) => {
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          documentNavigations += 1;
        }
      });
      page.on('download', () => {
        downloadCount += 1;
      });

      await openHistory(page);
      const initialNavigationCount = documentNavigations;
      await page.getByRole('combobox', { name: 'Filtrar por jogador' }).click();
      await page.getByRole('option', { name: 'Guto Prado' }).click();
      await expect(
        page.getByText(deletedPlayerMessage, { exact: true }),
      ).toBeVisible();

      await page.getByRole('button', { name: 'Exportar CSV' }).click();
      const toast = page.locator('[data-sonner-toast]');
      await expect(
        toast.getByText('Não foi possível exportar o histórico', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        toast.getByText(deletedPlayerMessage, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Exportar CSV' }),
      ).toBeEnabled();
      expect(api.transactionExports).toEqual([
        {
          type: 'COMPRA,VENDA',
          playerId: '4',
          method: 'GET',
          body: null,
        },
      ]);
      expect(downloadCount).toBe(0);
      expect(api.unexpectedRequests).toEqual([]);
      expect(documentNavigations).toBe(initialNavigationCount);
      await expectNoPageOverflow(page, viewport.width);
    },
  );
}
