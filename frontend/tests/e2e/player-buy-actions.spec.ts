import { expect, test, type Page } from '@playwright/test';
import type { BuyPlayerResult } from '../../src/types/market';
import type { ClubSummary } from '../../src/types/club';
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

const club: ClubSummary = {
  id: 3,
  name: 'Real Madrid CF',
  acronym: 'RMC',
  cash: 300,
  squad_value: 0,
  net_worth: 300,
};

const purchaseInput = {
  club_id: club.id,
  loyalty_until: '2027-03-20T10:15-03:00',
};

const purchaseResult: BuyPlayerResult = {
  id: 42,
  club_id: club.id,
  player_id: player.id,
  player_name: player.name,
  type: 'COMPRA',
  value: 76,
  fee: 3.8,
  penalty: 0,
  profit: null,
  cash_change: -79.8,
  created_at: '2026-10-22T15:00:00-03:00',
  contract: {
    purchase_value: 76,
    loyalty_until: purchaseInput.loyalty_until,
    status: 'ATIVO',
  },
  club_cash: 220.2,
};

const refusals = [
  {
    status: 400,
    title: 'Não foi possível realizar a compra',
    message: 'A data de fidelidade enviada não é válida.',
    description: 'data inválida',
  },
  {
    status: 404,
    title: 'Não foi possível realizar a compra',
    message: 'O clube comprador não foi encontrado.',
    description: 'clube não encontrado',
  },
  {
    status: 409,
    title: 'Compra recusada',
    message:
      'O custo da compra (105,00) passa do limite de 50% do caixa (90,92).',
    description: 'limite de caixa',
  },
  {
    status: 409,
    title: 'Compra recusada',
    message: 'O elenco do Delta FC já tem 12 jogadores, o limite da liga.',
    description: 'elenco cheio',
  },
  {
    status: 409,
    title: 'Compra recusada',
    message:
      'O Águias FC já vendeu o Lucas Ferraz e não pode comprá-lo de novo.',
    description: 'recompra',
  },
] as const;

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

type ApiMode =
  | { kind: 'refusal'; status: number; message: string }
  | { kind: 'network-retry' }
  | { kind: 'pending' };

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function mockApi(page: Page, mode: ApiMode) {
  const posts: Array<{ url: string; body: unknown }> = [];
  const unexpected: string[] = [];
  const documentRequests: string[] = [];
  const pendingGate = createDeferred();
  let purchased = false;

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

      if (mode.kind === 'refusal') {
        await route.fulfill({
          status: mode.status,
          json: { message: mode.message },
        });
        return;
      }

      if (mode.kind === 'network-retry' && posts.length === 1) {
        await route.abort('failed');
        return;
      }

      if (mode.kind === 'pending') await pendingGate.promise;

      purchased = true;
      await route.fulfill({ status: 200, json: purchaseResult });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      const params = url.searchParams;
      const free = params.get('free');
      const playerMatches =
        free === 'true' ? !purchased : free === 'false' ? purchased : true;
      const data = playerMatches
        ? [purchased ? { ...player, club_id: club.id } : player]
        : [];
      const total =
        free === 'true'
          ? Number(!purchased)
          : free === 'false'
            ? Number(purchased)
            : 1;
      const limit = Number(params.get('limit') ?? 10);

      await route.fulfill({
        json: {
          data: data.slice(0, limit),
          meta: {
            page: Number(params.get('page') ?? 1),
            limit,
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
    posts,
    unexpected,
    documentRequests,
    releasePending: () => pendingGate.resolve(),
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

async function expectDialogWithinViewport(page: Page, width: number) {
  const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
  const box = await dialog.boundingBox();

  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  await expectNoHorizontalPageOverflow(page, width);
}

async function openBuyDialog(page: Page) {
  await page.goto('/jogadores');
  await expect(page.getByRole('heading', { name: 'Jogadores' })).toBeVisible();

  const row = page.getByRole('row').filter({ hasText: player.name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Comprar', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillPurchaseForm(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
  const clubSelect = dialog.getByRole('combobox', {
    name: 'Clube comprador',
  });

  await clubSelect.click();
  await page
    .getByRole('option', {
      name: 'Real Madrid CF (RMC) · caixa 300,00',
    })
    .click();
  await dialog.locator('#buy-loyalty-date').fill('2027-03-20');
  await dialog.locator('#buy-loyalty-time').fill('10:15');
}

async function expectPurchaseRequest(
  posts: Array<{ url: string; body: unknown }>,
  count: number,
) {
  expect(posts).toHaveLength(count);
  for (const post of posts) {
    expect(post).toEqual({
      url: `/api/v1/players/${player.id}/buy`,
      body: purchaseInput,
    });
  }
}

for (const viewport of viewports) {
  for (const refusal of refusals) {
    test(`F06 shows the exact API message for ${refusal.description} at ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      const api = await mockApi(page, {
        kind: 'refusal',
        status: refusal.status,
        message: refusal.message,
      });
      const dialog = await openBuyDialog(page);
      await fillPurchaseForm(page);
      await expectDialogWithinViewport(page, viewport.width);

      await dialog.getByRole('button', { name: 'Confirmar compra' }).click();

      const alert = dialog.locator('[role="alert"]').filter({
        hasText: refusal.title,
      });
      await expect(alert).toBeVisible();
      await expect(
        alert.getByText(refusal.title, { exact: true }),
      ).toBeVisible();
      await expect(
        alert.getByText(refusal.message, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('dialog', { name: 'Compra concluída' }),
      ).toHaveCount(0);
      await expect(
        dialog.getByRole('button', { name: 'Confirmar compra' }),
      ).toBeEnabled();
      await expect(dialog.locator('#buy-loyalty-date')).toHaveValue(
        '2027-03-20',
      );
      await expect(dialog.locator('#buy-loyalty-time')).toHaveValue('10:15');
      await expectPurchaseRequest(api.posts, 1);
      expect(api.unexpected).toEqual([]);
      expect(api.documentRequests).toHaveLength(1);
      await expectDialogWithinViewport(page, viewport.width);
    });
  }

  test(`F06 retries a network failure and shows the API result at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page, { kind: 'network-retry' });
    const dialog = await openBuyDialog(page);
    await fillPurchaseForm(page);

    await dialog.getByRole('button', { name: 'Confirmar compra' }).click();

    const networkAlert = dialog.locator('[role="alert"]').filter({
      hasText: 'Sem conexão',
    });
    await expect(networkAlert).toBeVisible();
    await expect(
      networkAlert.getByText('Sem conexão', { exact: true }),
    ).toBeVisible();
    await expect(
      networkAlert.getByText(
        'A compra não foi confirmada. Verifique a conexão e tente de novo.',
        { exact: true },
      ),
    ).toBeVisible();
    const retryButton = dialog.getByRole('button', { name: 'Tentar de novo' });
    await expect(retryButton).toBeEnabled();
    await expect(dialog.locator('#buy-loyalty-date')).toHaveValue('2027-03-20');
    await expect(dialog.locator('#buy-loyalty-time')).toHaveValue('10:15');
    await expectPurchaseRequest(api.posts, 1);
    await expectDialogWithinViewport(page, viewport.width);

    await retryButton.click();

    const success = page.getByRole('dialog', { name: 'Compra concluída' });
    await expect(success).toBeVisible();
    await expect(
      success.getByText('Meia Lua agora é do Real Madrid CF.'),
    ).toBeVisible();
    await expect(success.getByText('220,20', { exact: true })).toBeVisible();
    await expect(success.getByText('ATIVO', { exact: true })).toBeVisible();
    await expectPurchaseRequest(api.posts, 2);
    expect(api.unexpected).toEqual([]);
    expect(api.documentRequests).toHaveLength(1);
    await expectNoHorizontalPageOverflow(page, viewport.width);
  });

  test(`F06 disables purchase controls and sends once on a double click at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page, { kind: 'pending' });
    const dialog = await openBuyDialog(page);
    await fillPurchaseForm(page);

    const submit = dialog.getByRole('button', { name: 'Confirmar compra' });
    const firstPost = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        request.method() === 'POST' &&
        url.pathname === `/api/v1/players/${player.id}/buy`
      );
    });
    await submit.dblclick();
    await firstPost;

    try {
      await expect(dialog.getByRole('status')).toContainText(
        'Enviando a compra',
      );
      await expect(dialog.getByRole('status')).toContainText(
        'Os controles ficam desabilitados até a resposta.',
      );
      await expect(
        dialog.getByRole('combobox', { name: 'Clube comprador' }),
      ).toBeDisabled();
      await expect(dialog.locator('#buy-loyalty-date')).toBeDisabled();
      await expect(dialog.locator('#buy-loyalty-time')).toBeDisabled();
      await expect(
        dialog.getByRole('button', { name: 'Cancelar' }),
      ).toBeDisabled();
      await expect(
        dialog.getByRole('button', { name: 'Comprando…' }),
      ).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expectPurchaseRequest(api.posts, 1);
      await expectDialogWithinViewport(page, viewport.width);
    } finally {
      api.releasePending();
    }

    const success = page.getByRole('dialog', { name: 'Compra concluída' });
    await expect(success).toBeVisible();
    await expect(
      success.getByText('Meia Lua agora é do Real Madrid CF.'),
    ).toBeVisible();
    await expectPurchaseRequest(api.posts, 1);
    expect(api.unexpected).toEqual([]);
    expect(api.documentRequests).toHaveLength(1);
    await expectNoHorizontalPageOverflow(page, viewport.width);
  });
}
