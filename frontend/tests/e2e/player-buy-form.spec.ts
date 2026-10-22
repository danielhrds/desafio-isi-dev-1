import { expect, test, type Page } from '@playwright/test';
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

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

type ClubSummaryMode = 'ready' | 'pending' | 'error-then-ready' | 'empty';

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function mockApi(page: Page, mode: ClubSummaryMode) {
  const posts: string[] = [];
  const unexpected: string[] = [];
  const summaryGate = createDeferred();
  let summaryAttempts = 0;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      const pageNumber = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 10);
      await route.fulfill({
        json: {
          data: pageNumber === 1 ? [player].slice(0, limit) : [],
          meta: {
            page: pageNumber,
            limit,
            total_items: 1,
            total_pages: 1,
          },
        },
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      if (url.searchParams.get('sort') !== 'name') {
        await route.fulfill({
          json: [
            {
              id: club.id,
              name: club.name,
              acronym: club.acronym,
            },
          ],
        });
        return;
      }

      summaryAttempts += 1;

      if (mode === 'pending' && summaryAttempts === 1) {
        await summaryGate.promise;
      }

      if (mode === 'error-then-ready' && summaryAttempts <= 4) {
        await route.fulfill({
          status: 503,
          json: { message: 'Falha ao consultar clubes.' },
        });
        return;
      }

      await route.fulfill({
        json: mode === 'empty' ? [] : [club],
      });
      return;
    }

    if (
      request.method() === 'POST' &&
      url.pathname.startsWith('/api/v1/players/') &&
      url.pathname.endsWith('/buy')
    ) {
      posts.push(url.pathname);
      await route.fulfill({
        status: 200,
        json: { message: 'Unexpected purchase request in form test.' },
      });
      return;
    }

    unexpected.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return {
    posts,
    unexpected,
    summaryAttempts: () => summaryAttempts,
    releaseSummary: () => summaryGate.resolve(),
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

for (const viewport of viewports) {
  test(`F06 validates all required purchase fields at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page, 'ready');
    const dialog = await openBuyDialog(page);

    await dialog.getByRole('button', { name: 'Confirmar compra' }).click();

    const clubField = dialog.getByRole('combobox', {
      name: 'Clube comprador',
    });
    const dateField = dialog.locator('#buy-loyalty-date');
    const timeField = dialog.locator('#buy-loyalty-time');
    await expect(clubField).toHaveAttribute('aria-invalid', 'true');
    await expect(clubField).toHaveAttribute(
      'aria-describedby',
      'buy-club-error',
    );
    await expect(dialog.locator('#buy-club-error')).toHaveText(
      'Selecione o clube comprador.',
    );
    await expect(dateField).toHaveAttribute('aria-invalid', 'true');
    await expect(dateField).toHaveAttribute(
      'aria-describedby',
      'buy-loyalty-date-error',
    );
    await expect(dialog.locator('#buy-loyalty-date-error')).toHaveText(
      'Informe a data do fim da fidelidade.',
    );
    await expect(timeField).toHaveAttribute('aria-invalid', 'true');
    await expect(timeField).toHaveAttribute(
      'aria-describedby',
      'buy-loyalty-time-error',
    );
    await expect(dialog.locator('#buy-loyalty-time-error')).toHaveText(
      'Informe o horário do fim da fidelidade.',
    );
    await expectNoHorizontalPageOverflow(page, viewport.width);

    expect(api.posts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });

  test(`F06 keeps purchase controls disabled while clubs load at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page, 'pending');
    await page.goto('/jogadores');
    await expect(
      page.getByRole('heading', { name: 'Jogadores' }),
    ).toBeVisible();

    const pendingRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        request.method() === 'GET' &&
        url.pathname === '/api/v1/clubs' &&
        url.searchParams.get('sort') === 'name'
      );
    });
    const row = page.getByRole('row').filter({ hasText: player.name });
    await row.getByRole('button', { name: 'Comprar', exact: true }).click();
    await pendingRequest;

    const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
    const clubField = dialog.getByRole('combobox', {
      name: 'Clube comprador',
    });
    await expect(dialog).toBeVisible();
    await expect(clubField).toContainText('Carregando clubes...');
    await expect(clubField).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: 'Confirmar compra' }),
    ).toBeDisabled();
    await expectNoHorizontalPageOverflow(page, viewport.width);

    try {
      api.releaseSummary();
      await expect(clubField).toBeEnabled();
      await expect(
        dialog.getByRole('button', { name: 'Confirmar compra' }),
      ).toBeEnabled();
    } finally {
      api.releaseSummary();
    }

    expect(api.posts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });

  test(`F06 displays the club lookup error and retries at ${viewport.label}`, async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page, 'error-then-ready');
    const dialog = await openBuyDialog(page);

    await expect(
      dialog.getByText('Falha ao consultar clubes.', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    const attemptsBeforeRetry = api.summaryAttempts();
    expect(attemptsBeforeRetry).toBeGreaterThan(1);

    const clubField = dialog.getByRole('combobox', {
      name: 'Clube comprador',
    });
    await expect(clubField).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: 'Confirmar compra' }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeEnabled();
    await expectNoHorizontalPageOverflow(page, viewport.width);

    await dialog.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(clubField).toBeEnabled();
    expect(api.summaryAttempts()).toBe(attemptsBeforeRetry + 1);
    await clubField.click();
    await expect(
      page.getByRole('option', {
        name: 'Real Madrid CF (RMC) · caixa 300,00',
      }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expectNoHorizontalPageOverflow(page, viewport.width);

    expect(api.posts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });

  test(`F06 explains when there are no buyer clubs at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page, 'empty');
    const dialog = await openBuyDialog(page);

    await expect(
      dialog.getByText('Cadastre um clube antes de comprar jogadores.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('combobox', { name: 'Clube comprador' }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: 'Confirmar compra' }),
    ).toBeDisabled();
    await expectNoHorizontalPageOverflow(page, viewport.width);

    expect(api.posts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });
}
