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

interface SaleScenario {
  description: string;
  result: SellPlayerResult;
  expected: {
    purchaseValue: string;
    saleValue: string;
    remainingDays: string;
    penalty: string;
    profit: string;
    fee: string;
    cashChange: string;
    clubCash: string;
    contractStatus: string;
  };
}

function saleResult(
  result: Pick<
    SellPlayerResult,
    | 'purchase_value'
    | 'value'
    | 'remaining_days'
    | 'penalty_rate'
    | 'penalty'
    | 'profit'
    | 'fee'
    | 'cash_change'
    | 'club_cash'
    | 'contract_status'
  >,
): SellPlayerResult {
  return {
    id: 31,
    club_id: club.id,
    player_id: player.id,
    player_name: player.name,
    type: 'VENDA',
    value: result.value,
    fee: result.fee,
    penalty: result.penalty,
    profit: result.profit,
    cash_change: result.cash_change,
    created_at: '2026-10-22T16:40:00-03:00',
    purchase_value: result.purchase_value,
    remaining_days: result.remaining_days,
    penalty_rate: result.penalty_rate,
    contract_status: result.contract_status,
    club_cash: result.club_cash,
  };
}

const saleScenarios: SaleScenario[] = [
  {
    description: 'lucro positivo, multa limitada e comissão progressiva',
    result: saleResult({
      purchase_value: 60,
      value: 75,
      remaining_days: 200,
      penalty_rate: 20,
      penalty: 10,
      profit: 15,
      fee: 2,
      cash_change: 63,
      club_cash: 363,
      contract_status: 'RESCINDIDO',
    }),
    expected: {
      purchaseValue: '60,00',
      saleValue: '75,00',
      remainingDays: '200',
      penalty: '10,00',
      profit: '+15,00',
      fee: '2,00',
      cashChange: '+63,00',
      clubCash: '363,00',
      contractStatus: 'Rescindido',
    },
  },
  {
    description: 'fidelidade cumprida e prejuízo sem comissão',
    result: saleResult({
      purchase_value: 28.8,
      value: 24,
      remaining_days: 0,
      penalty_rate: 0,
      penalty: 0,
      profit: -4.8,
      fee: 0,
      cash_change: 24,
      club_cash: 324,
      contract_status: 'ENCERRADO',
    }),
    expected: {
      purchaseValue: '28,80',
      saleValue: '24,00',
      remainingDays: '0',
      penalty: '0,00',
      profit: '-4,80',
      fee: '0,00',
      cashChange: '+24,00',
      clubCash: '324,00',
      contractStatus: 'Encerrado',
    },
  },
  {
    description: 'lucro zero com multa e comissão zerada',
    result: saleResult({
      purchase_value: 40,
      value: 40,
      remaining_days: 30,
      penalty_rate: 5,
      penalty: 2,
      profit: 0,
      fee: 0,
      cash_change: 38,
      club_cash: 338,
      contract_status: 'RESCINDIDO',
    }),
    expected: {
      purchaseValue: '40,00',
      saleValue: '40,00',
      remainingDays: '30',
      penalty: '2,00',
      profit: '+0,00',
      fee: '0,00',
      cashChange: '+38,00',
      clubCash: '338,00',
      contractStatus: 'Rescindido',
    },
  },
];

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

async function mockSaleApi(page: Page, result: SellPlayerResult) {
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
      hasSold = true;
      await route.fulfill({ json: result });
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

  return { saleRequests, unexpectedRequests };
}

async function expectResultRow(
  dialog: ReturnType<Page['getByRole']>,
  label: string,
  expectedValue: string,
) {
  const definition = dialog
    .getByText(label, { exact: true })
    .locator('xpath=..')
    .locator('xpath=following-sibling::dd');

  await expect(definition).toHaveText(expectedValue);
}

for (const scenario of saleScenarios) {
  for (const viewport of viewports) {
    test(`mostra o resultado da venda com ${scenario.description} em ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const { saleRequests, unexpectedRequests } = await mockSaleApi(
        page,
        scenario.result,
      );
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
      await expect(
        page.getByRole('heading', { name: club.name }),
      ).toBeVisible();
      const initialNavigationCount = mainFrameNavigations;

      await page.getByRole('button', { name: `Vender ${player.name}` }).click();
      const confirmation = page.getByRole('dialog', {
        name: `Vender ${player.name}?`,
      });
      await expect(confirmation).toBeVisible();
      await expect(
        confirmation.getByRole('button', { name: 'Confirmar venda' }),
      ).toBeEnabled();
      await confirmation
        .getByRole('button', { name: 'Confirmar venda' })
        .click();

      const resultDialog = page.getByRole('dialog', {
        name: 'Venda concluída',
      });
      await expect(resultDialog).toBeVisible();
      await expect(
        resultDialog.getByText(`${player.name} voltou a ficar livre.`, {
          exact: true,
        }),
      ).toBeVisible();
      await expectResultRow(
        resultDialog,
        'Valor de compra',
        scenario.expected.purchaseValue,
      );
      await expectResultRow(
        resultDialog,
        'Valor de venda',
        scenario.expected.saleValue,
      );
      await expectResultRow(
        resultDialog,
        'Dias restantes',
        scenario.expected.remainingDays,
      );
      await expectResultRow(resultDialog, 'Multa', scenario.expected.penalty);
      await expectResultRow(resultDialog, 'Lucro', scenario.expected.profit);
      await expectResultRow(resultDialog, 'Comissão', scenario.expected.fee);
      await expectResultRow(
        resultDialog,
        'Crédito no caixa',
        scenario.expected.cashChange,
      );
      await expectResultRow(
        resultDialog,
        `Novo caixa do ${club.name}`,
        scenario.expected.clubCash,
      );
      await expect(
        resultDialog.getByText(scenario.expected.contractStatus, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        resultDialog.getByRole('button', { name: 'Ver histórico' }),
      ).toBeVisible();

      expect(saleRequests).toEqual([{ method: 'POST', body: null }]);
      expect(unexpectedRequests).toEqual([]);
      expect(mainFrameNavigations).toBe(initialNavigationCount);

      if (viewport.width === 375) {
        expect(
          await page.evaluate(() => ({
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            viewportWidth: window.innerWidth,
            scrollX: window.scrollX,
          })),
        ).toEqual({
          documentWidth: 375,
          bodyWidth: 375,
          viewportWidth: 375,
          scrollX: 0,
        });

        const closeButton = resultDialog
          .getByRole('button', { name: 'Fechar' })
          .first();
        await closeButton.scrollIntoViewIfNeeded();
        await expect(closeButton).toBeInViewport();
      }
    });
  }
}
