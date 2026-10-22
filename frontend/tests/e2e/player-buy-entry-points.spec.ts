import { expect, test, type Page } from '@playwright/test';
import type { ClubDetail, ClubLineup } from '../../src/types/club';
import type { ClubTransactionsResponse } from '../../src/types/transaction';
import type { PlayerListItem } from '../../src/types/player';

const club: ClubDetail = {
  id: 3,
  name: 'Real Madrid CF',
  acronym: 'RMC',
  cash: 300,
  squad_value: 0,
  net_worth: 300,
  players: [],
};

const freePlayer: PlayerListItem = {
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

const assignedPlayer: PlayerListItem = {
  ...freePlayer,
  id: 16,
  name: 'Bia Nogueira',
  position: 'ZAG',
  club_id: club.id,
};

const players = [freePlayer, assignedPlayer];

const lineup: ClubLineup = {
  club_id: club.id,
  formation: null,
  complete: false,
  players: [],
};

const transactions: ClubTransactionsResponse = {
  data: [],
  summary: {
    total_spent: 0,
    total_received: 0,
    total_fees: 0,
    total_penalties: 0,
    total_profit: 0,
  },
};

const viewports = [
  { label: 'desktop', width: 1366, height: 768 },
  { label: '375 px', width: 375, height: 812 },
] as const;

async function mockApi(page: Page) {
  const playerQueries: URLSearchParams[] = [];
  const buyPosts: string[] = [];
  const documentRequests: string[] = [];
  const unexpected: string[] = [];

  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests.push(request.url());
    }
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/v1/players') {
      const params = new URLSearchParams(url.searchParams);
      playerQueries.push(params);
      let matchingPlayers = players;

      if (params.get('free') === 'true') {
        matchingPlayers = players.filter((player) => player.club_id === null);
      } else if (params.get('free') === 'false') {
        matchingPlayers = players.filter((player) => player.club_id !== null);
      }

      if (params.has('club_id')) {
        matchingPlayers = matchingPlayers.filter(
          (player) => player.club_id === Number(params.get('club_id')),
        );
      }

      const pageNumber = Number(params.get('page') ?? 1);
      const limit = Number(params.get('limit') ?? 10);
      const offset = (pageNumber - 1) * limit;
      const totalPages = Math.ceil(matchingPlayers.length / limit);

      await route.fulfill({
        json: {
          data: matchingPlayers.slice(offset, offset + limit),
          meta: {
            page: pageNumber,
            limit,
            total_items: matchingPlayers.length,
            total_pages: totalPages,
          },
        },
      });
      return;
    }

    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({ json: [club] });
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
      url.pathname === `/api/v1/clubs/${club.id}/transactions`
    ) {
      await route.fulfill({ json: transactions });
      return;
    }

    if (
      request.method() === 'POST' &&
      url.pathname.startsWith('/api/v1/players/') &&
      url.pathname.endsWith('/buy')
    ) {
      buyPosts.push(url.pathname);
      await route.fulfill({
        status: 200,
        json: { message: 'Unexpected purchase request in entry-point test.' },
      });
      return;
    }

    unexpected.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({
      status: 404,
      json: { message: 'Unexpected API route.' },
    });
  });

  return { playerQueries, buyPosts, documentRequests, unexpected };
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

async function openFreePlayerRow(page: Page) {
  const row = page.getByRole('row').filter({ hasText: freePlayer.name });
  await expect(row).toBeVisible();
  return row;
}

async function expectUnselectedPurchaseDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Comprar jogador' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(freePlayer.name, { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('combobox', { name: 'Clube comprador' }),
  ).toContainText('Selecione o clube');
  await expect(dialog.locator('#buy-loyalty-date')).toHaveValue('');
  await expect(dialog.locator('#buy-loyalty-time')).toHaveValue('');
  return dialog;
}

for (const viewport of viewports) {
  test(`F06 opens, cancels and resets a purchase from the player row at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page);

    await page.goto('/jogadores');
    await expect(
      page.getByRole('heading', { name: 'Jogadores' }),
    ).toBeVisible();
    await expectNoHorizontalPageOverflow(page, viewport.width);

    const row = await openFreePlayerRow(page);
    await row.getByRole('button', { name: 'Comprar', exact: true }).click();
    let dialog = await expectUnselectedPurchaseDialog(page);
    await expectNoHorizontalPageOverflow(page, viewport.width);

    await dialog.getByRole('combobox', { name: 'Clube comprador' }).click();
    await page
      .getByRole('option', {
        name: 'Real Madrid CF (RMC) · caixa 300,00',
      })
      .click();
    await dialog.locator('#buy-loyalty-date').fill('2027-03-20');
    await dialog.locator('#buy-loyalty-time').fill('10:15');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).not.toBeVisible();

    await row.getByRole('button', { name: 'Comprar', exact: true }).click();
    dialog = await expectUnselectedPurchaseDialog(page);
    await expectNoHorizontalPageOverflow(page, viewport.width);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    expect(api.buyPosts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });

  test(`F06 opens the selected player's purchase from the actions menu and closes without a request at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page);

    await page.goto('/jogadores');
    const row = await openFreePlayerRow(page);
    await row
      .getByRole('button', { name: `Abrir ações de ${freePlayer.name}` })
      .click();

    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Comprar' })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Comprar' }).click();

    const dialog = await expectUnselectedPurchaseDialog(page);
    await expectNoHorizontalPageOverflow(page, viewport.width);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    expect(api.buyPosts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });

  test(`F06 does not offer purchase for an assigned player at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page);

    await page.goto('/jogadores');
    const row = page.getByRole('row').filter({ hasText: assignedPlayer.name });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole('button', { name: 'Comprar', exact: true }),
    ).toHaveCount(0);

    await row
      .getByRole('button', { name: `Abrir ações de ${assignedPlayer.name}` })
      .click();
    await expect(
      page.getByRole('menu').getByRole('menuitem', { name: 'Comprar' }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expectNoHorizontalPageOverflow(page, viewport.width);

    expect(api.buyPosts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });

  test(`F06 club shortcut opens players without club context at ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const api = await mockApi(page);

    await page.goto(`/clubes/${club.id}`);
    await expect(page.getByRole('heading', { name: club.name })).toBeVisible();
    const documentCountBeforeShortcut = api.documentRequests.length;
    await expectNoHorizontalPageOverflow(page, viewport.width);

    await page.getByRole('link', { name: 'Comprar jogadores' }).click();
    await expect(page).toHaveURL(/\/jogadores$/);
    await expect(
      page.getByRole('heading', { name: 'Jogadores' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Clube' })).toContainText(
      'Clube',
    );

    const playerQueriesWithoutClub = api.playerQueries.filter(
      (query) => !query.has('club_id'),
    );
    expect(playerQueriesWithoutClub.length).toBeGreaterThan(0);
    expect(api.playerQueries.some((query) => query.has('club_id'))).toBe(false);
    expect(api.documentRequests).toHaveLength(documentCountBeforeShortcut);

    const row = await openFreePlayerRow(page);
    await row.getByRole('button', { name: 'Comprar', exact: true }).click();
    await expectUnselectedPurchaseDialog(page);
    await expectNoHorizontalPageOverflow(page, viewport.width);

    expect(api.buyPosts).toEqual([]);
    expect(api.unexpected).toEqual([]);
  });
}
