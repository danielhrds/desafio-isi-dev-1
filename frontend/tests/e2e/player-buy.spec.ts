import { expect, test, type Page } from '@playwright/test';
import type { BuyPlayerResult } from '../../src/types/market';
import type { PlayerListItem } from '../../src/types/player';

const player: PlayerListItem = {
  id: 15,
  name: 'Meia Lua',
  position: 'MEI',
  age: 26,
  agility: 76,
  condition: 'APTO',
  club_id: null,
  overall: 78,
  base_value: 70,
  market_value: 76,
};

const club = {
  id: 3,
  name: 'Real Madrid CF',
  acronym: 'RMC',
  cash: 300,
  squad_value: 0,
  net_worth: 300,
};

const loyaltyInput = {
  date: '2027-03-20',
  time: '10:15',
  loyalty_until: '2027-03-20T10:15-03:00',
};

const purchases = [
  {
    description: 'com taxa',
    value: 76,
    fee: 3.8,
    cash_change: -79.8,
    total: '79,80',
    club_cash: 220.2,
  },
  {
    description: 'sem taxa',
    value: 30,
    fee: 0,
    cash_change: -30,
    total: '30,00',
    club_cash: 270,
  },
] as const;

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

async function mockPurchaseApi(
  page: Page,
  purchase: (typeof purchases)[number],
) {
  let purchased = false;
  const posts: Array<{ url: string; body: unknown }> = [];
  const playerQueries: URLSearchParams[] = [];
  const documentRequests: string[] = [];
  const unexpected: string[] = [];

  const result: BuyPlayerResult = {
    id: 42,
    club_id: club.id,
    player_id: player.id,
    player_name: 'Meia Lua',
    type: 'COMPRA',
    value: purchase.value,
    fee: purchase.fee,
    penalty: 0,
    profit: null,
    cash_change: purchase.cash_change,
    created_at: '2026-10-22T15:00:00-03:00',
    contract: {
      purchase_value: purchase.value,
      loyalty_until: '2027-03-20T10:15:00-03:00',
      status: 'ATIVO',
    },
    club_cash: purchase.club_cash,
  };

  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests.push(request.url());
    }
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === 'POST' &&
      url.pathname === `/api/v1/players/${player.id}/buy`
    ) {
      posts.push({ url: url.pathname, body: request.postDataJSON() });
      purchased = true;
      await route.fulfill({ status: 200, json: result });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      const params = url.searchParams;
      playerQueries.push(new URLSearchParams(params));
      const free = params.get('free');
      const matches =
        free === 'true' ? !purchased : free === 'false' ? purchased : true;
      const data = matches
        ? [purchased ? { ...player, club_id: club.id } : player]
        : [];
      const total =
        free === 'true'
          ? Number(!purchased)
          : free === 'false'
            ? Number(purchased)
            : 1;

      await route.fulfill({
        json: {
          data: params.get('limit') === '1' ? data.slice(0, 1) : data,
          meta: {
            page: Number(params.get('page') ?? 1),
            limit: Number(params.get('limit') ?? 10),
            total_items: total,
            total_pages: total,
          },
        },
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({ json: [club] });
      return;
    }

    unexpected.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 404, json: { message: 'Rota inesperada.' } });
  });

  return {
    result,
    posts,
    playerQueries,
    documentRequests,
    unexpected,
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

for (const purchase of purchases) {
  for (const viewport of viewports) {
    test(`F06 completes a purchase ${purchase.description} at ${viewport.label}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const api = await mockPurchaseApi(page, purchase);

      await page.goto('/jogadores');
      await expect(
        page.getByRole('heading', { name: 'Jogadores' }),
      ).toBeVisible();
      await expectNoHorizontalPageOverflow(page, viewport.width);

      const row = page.getByRole('row').filter({ hasText: player.name });
      await row.getByRole('button', { name: 'Comprar', exact: true }).click();

      const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(player.name, { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByText('76,00', { exact: true })).toBeVisible();

      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(
        viewport.width,
      );

      const clubSelect = dialog.getByRole('combobox', {
        name: 'Clube comprador',
      });
      await clubSelect.click();
      await page
        .getByRole('option', {
          name: 'Real Madrid CF (RMC) · caixa 300,00',
        })
        .click();
      await dialog.locator('#buy-loyalty-date').fill(loyaltyInput.date);
      await dialog.locator('#buy-loyalty-time').fill(loyaltyInput.time);
      await expectNoHorizontalPageOverflow(page, viewport.width);

      await dialog.getByRole('button', { name: 'Confirmar compra' }).click();

      const success = page.getByRole('dialog', { name: 'Compra concluída' });
      await expect(success).toBeVisible();
      await expect(
        success.getByText('Meia Lua agora é do Real Madrid CF.'),
      ).toBeVisible();

      const labels = success.locator('dt > span:first-child');
      const values = success.locator('dd');
      await expect(labels).toHaveText([
        'Valor',
        'Taxa',
        'Custo total',
        'Fim da fidelidade',
        'Contrato',
        `Novo caixa do ${club.name}`,
      ]);
      await expect(values.nth(0)).toHaveText(
        purchase.value.toFixed(2).replace('.', ','),
      );
      await expect(values.nth(1)).toHaveText(
        purchase.fee.toFixed(2).replace('.', ','),
      );
      await expect(values.nth(2)).toHaveText(purchase.total);
      await expect(values.nth(3)).toHaveText('20/03/2027, 10:15');
      await expect(values.nth(4)).toHaveText('ATIVO');
      await expect(values.nth(5)).toHaveText(
        purchase.club_cash.toFixed(2).replace('.', ','),
      );
      await expect(
        success.getByRole('link', { name: 'Ver clube' }),
      ).toHaveAttribute('href', `/clubes/${club.id}`);

      expect(api.posts).toEqual([
        {
          url: `/api/v1/players/${player.id}/buy`,
          body: {
            club_id: club.id,
            loyalty_until: loyaltyInput.loyalty_until,
          },
        },
      ]);
      expect(
        api.playerQueries.some((query) => query.get('free') === 'true'),
      ).toBe(true);
      expect(
        api.playerQueries.some((query) => query.get('free') === 'false'),
      ).toBe(true);
      expect(api.unexpected).toEqual([]);
      expect(api.documentRequests).toHaveLength(1);

      await expectNoHorizontalPageOverflow(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(
          `f06-purchase-${purchase.description}-${viewport.label}.png`,
        ),
        fullPage: true,
      });

      await success.getByRole('button', { name: 'Fechar' }).first().click();
      await expect(success).not.toBeVisible();
      const updatedPlayerRow = page
        .getByRole('table', { name: 'Jogadores' })
        .getByRole('row')
        .filter({ hasText: player.name });
      await expect(updatedPlayerRow).toContainText(club.acronym);
      await expect(updatedPlayerRow).toContainText(club.name);
      await expect(
        updatedPlayerRow.getByRole('button', {
          name: 'Comprar',
          exact: true,
        }),
      ).toHaveCount(0);
    });
  }
}
