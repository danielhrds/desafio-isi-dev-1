import { expect, test, type Page } from '@playwright/test';
import type {
  ClubDetail,
  ClubLineup,
  ClubRosterPlayer,
  ClubSummary,
} from '../../src/types/club';
import type { SellPlayerResult } from '../../src/types/market';
import type { PlayerListResponse } from '../../src/types/player';
import type { ClubTransactionsResponse } from '../../src/types/transaction';

const player: ClubRosterPlayer = {
  id: 7,
  name: 'Meia Lua',
  position: 'MEI',
  age: 26,
  agility: 76,
  condition: 'APTO',
  club_id: 1,
  overall: 78,
  base_value: 50,
  market_value: 51,
  pace: 72,
  shooting: 68,
  passing: 82,
  dribbling: 79,
  defending: 55,
  physical: 70,
  potential: 88,
  contract: {
    purchase_value: 60,
    loyalty_until: '2027-03-02T10:15:00-03:00',
    remaining_days: 3,
    penalty_rate: 5,
  },
};

const club: ClubDetail = {
  id: 1,
  name: 'Águias FC',
  acronym: 'AGU',
  cash: 300,
  squad_value: player.market_value,
  net_worth: 351,
  players: [player],
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

const playerPage: PlayerListResponse = {
  data: [],
  meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
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

const saleResult: SellPlayerResult = {
  id: 31,
  club_id: club.id,
  player_id: player.id,
  player_name: player.name,
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

type SaleReply =
  | { status: 404 | 409; message: string; gate?: Promise<void> }
  | { status: 200; result: SellPlayerResult };

function createGate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
}

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

async function mockSaleApi(page: Page) {
  const firstReplyGate = createGate();
  const replies: SaleReply[] = [
    {
      status: 404,
      message: 'Jogador não encontrado.',
      gate: firstReplyGate.promise,
    },
    { status: 409, message: 'Jogador está livre.' },
    { status: 200, result: saleResult },
  ];
  const saleRequests: Array<{ method: string; body: string | null }> = [];
  const unexpectedRequests: string[] = [];
  let hasSold = false;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === 'POST' &&
      url.pathname === `/api/v1/players/${player.id}/sell`
    ) {
      saleRequests.push({
        method: request.method(),
        body: request.postData(),
      });
      const reply = replies.shift();

      if (!reply) {
        unexpectedRequests.push(
          `Unexpected sale attempt ${saleRequests.length}`,
        );
        await route.fulfill({
          status: 500,
          json: { message: 'Unexpected sale attempt' },
        });
        return;
      }

      if ('gate' in reply && reply.gate) await reply.gate;

      if (reply.status === 200) {
        hasSold = true;
        await route.fulfill({ status: reply.status, json: reply.result });
      } else {
        await route.fulfill({
          status: reply.status,
          json: { message: reply.message },
        });
      }
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      await route.fulfill({ json: playerPage });
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
      await route.fulfill({
        json: hasSold ? { ...club, players: [] } : club,
      });
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
      url.pathname === `/api/v1/clubs/${club.id}/transactions`
    ) {
      await route.fulfill({ json: emptyTransactions });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route' },
    });
  });

  return {
    saleRequests,
    unexpectedRequests,
    releaseFirstReply: firstReplyGate.release,
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

for (const viewport of viewports) {
  test(`recusa e permite repetir a venda sem POST duplicado em ${viewport.label}`, async ({
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

    await page.goto(`/clubes/${club.id}`);
    await expect(page.getByRole('heading', { name: club.name })).toBeVisible();
    const initialNavigationCount = mainFrameNavigations;
    await page.getByRole('button', { name: `Vender ${player.name}` }).click();

    const dialog = page.getByRole('dialog', { name: `Vender ${player.name}?` });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Confirmar venda' });
    await expect(confirm).toBeEnabled();

    try {
      await confirm.dblclick();
      await expect.poll(() => api.saleRequests.length).toBe(1);
      const pendingConfirm = dialog.getByRole('button', {
        name: 'Vendendo…',
      });
      await expect(
        dialog.getByText(/Enviando a venda/, { exact: false }),
      ).toBeVisible();
      await expect(pendingConfirm).toBeDisabled();
      await expect(
        dialog.getByRole('button', { name: 'Cancelar' }),
      ).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Fechar' })).toHaveCount(
        0,
      );
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      expect(api.saleRequests).toEqual([{ method: 'POST', body: null }]);
      await expectNoHorizontalPageOverflow(page, viewport.width);
    } finally {
      api.releaseFirstReply();
    }

    await expect(
      dialog.getByText('Jogador não encontrado.', { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Confirmar venda' }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole('button', { name: 'Cancelar' }),
    ).toBeEnabled();
    await expect(
      page.getByRole('dialog', { name: 'Venda concluída' }),
    ).toHaveCount(0);
    await expectNoHorizontalPageOverflow(page, viewport.width);

    await dialog.getByRole('button', { name: 'Confirmar venda' }).click();
    await expect(
      dialog.getByText('Jogador está livre.', { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Confirmar venda' }),
    ).toBeEnabled();
    await expectNoHorizontalPageOverflow(page, viewport.width);

    await dialog.getByRole('button', { name: 'Confirmar venda' }).click();
    const success = page.getByRole('dialog', { name: 'Venda concluída' });
    await expect(success).toBeVisible();
    await expect(success.getByText('75,00', { exact: true })).toBeVisible();
    expect(api.saleRequests).toEqual([
      { method: 'POST', body: null },
      { method: 'POST', body: null },
      { method: 'POST', body: null },
    ]);
    expect(api.unexpectedRequests).toEqual([]);
    expect(mainFrameNavigations).toBe(initialNavigationCount);
    await expectNoHorizontalPageOverflow(page, viewport.width);
  });
}
