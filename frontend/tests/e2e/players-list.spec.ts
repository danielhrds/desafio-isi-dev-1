import { expect, test } from '@playwright/test';
import type { PlayerListItem } from '../../src/types/player';

const names = [
  'André Lacerda',
  'Bruno Tavares',
  'Danilo Freitas',
  'Diego Ramos',
  'Eduardo Paiva',
  'Ênio Carvalho',
  'Felipe Moura',
  'Gabriel Antunes',
  'Heitor Gomes',
  'Ícaro Mendes',
];

const players: PlayerListItem[] = names.map((name, index) => ({
  id: index + 1,
  name,
  position: (
    [
      'GOL',
      'GOL',
      'ZAG',
      'LAT',
      'MEI',
      'LAT',
      'ZAG',
      'ATA',
      'MEI',
      'ATA',
    ] as const
  )[index],
  overall: [68, 71, 73, 72, 76, 69, 77, 79, 77, 67][index],
  agility: [70, 58, 25, 81, 68, 83, 45, 77, 92, 12][index],
  age: [31, 29, 30, 20, 26, 18, 27, 24, 22, 40][index],
  condition: (
    [
      'APTO',
      'APTO',
      'MAL_CONDICIONADO',
      'MAL_CONDICIONADO',
      'APTO',
      'DOENTE',
      'APTO',
      'APTO',
      'MAL_CONDICIONADO',
      'DOENTE',
    ] as const
  )[index],
  base_value: [26, 32, 36, 39.44, 46, 33.88, 52, 64, 52, 24][index],
  market_value: [26, 32, 27, 40.43, 46, 32.19, 52, 64, 48.1, 14.4][index],
  club_id: [2, 1, 2, 1, null, null, 1, 2, 3, null][index],
}));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/players')) {
      if (url.searchParams.get('limit') === '1') {
        const free = url.searchParams.get('free');
        const total = free === 'true' ? 7 : free === 'false' ? 16 : 23;
        await route.fulfill({
          json: {
            data: [free === 'true' ? players[4] : players[0]],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          data: players,
          meta: { page: 1, limit: 10, total_items: 23, total_pages: 3 },
        },
      });
      return;
    }
    if (url.pathname.endsWith('/clubs')) {
      await route.fulfill({
        json: [
          { id: 1, name: 'Águias FC', acronym: 'AGU' },
          { id: 2, name: 'Delta FC', acronym: 'DEL' },
          { id: 3, name: 'Épsilon EC', acronym: 'EPS' },
        ],
      });
      return;
    }
    await route.continue();
  });
});

test('J01 desktop list renders API data and its first page', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/jogadores');

  await expect(page.getByRole('heading', { name: 'Jogadores' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Jogadores' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /André Lacerda/ })).toBeVisible();
  await expect(page.getByText('Mostrando 1–10 de 23 jogadores')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();

  await page.screenshot({
    path: testInfo.outputPath('j01-desktop.png'),
    fullPage: true,
  });
});

test('F5 keeps the players table, menus and create dialog usable at 375px', async ({
  page,
}, testInfo) => {
  const mutationRequests: string[] = [];
  page.on('request', (request) => {
    if (
      new URL(request.url()).pathname.startsWith('/api/v1/') &&
      request.method() !== 'GET'
    ) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  // This scenario only opens and cancels controls; never forward a mutation.
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.abort();
      return;
    }
    await route.fallback();
  });

  async function expectNoPageOverflow() {
    expect(
      await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        scrollX: window.scrollX,
      })),
    ).toEqual({ documentWidth: 375, bodyWidth: 375, scrollX: 0 });
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/jogadores');

  await expect(page.getByRole('heading', { name: 'Jogadores' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table).toBeVisible();
  await expectNoPageOverflow();
  await page.screenshot({
    path: testInfo.outputPath('j01-mobile.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Alternar menu' }).click();
  const sidebar = page.getByRole('dialog', { name: 'Sidebar', exact: true });
  await expect(sidebar).toBeInViewport({ ratio: 1 });
  const playersLink = sidebar.getByRole('link', { name: 'Jogadores' });
  await expect(playersLink).toBeInViewport({ ratio: 1 });
  await expect(playersLink).toHaveAttribute('href', '/jogadores');
  await expectNoPageOverflow();
  await page.screenshot({
    path: testInfo.outputPath('j01-mobile-menu.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(sidebar).not.toBeVisible();

  const tableContainer = page
    .locator('[data-slot="table-container"]')
    .filter({ has: table });
  const tableSize = await tableContainer.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
    scrollLeft: element.scrollLeft,
  }));
  expect(tableSize.width).toBeLessThanOrEqual(375);
  expect(tableSize.scrollWidth).toBeGreaterThan(tableSize.width);
  expect(tableSize.overflowX).toMatch(/auto|scroll/);
  expect(tableSize.scrollLeft).toBe(0);
  await tableContainer.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await tableContainer.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);

  const freePlayerRow = table
    .getByRole('row')
    .filter({ hasText: 'Eduardo Paiva' });
  const actions = freePlayerRow.getByRole('button', {
    name: 'Abrir ações de Eduardo Paiva',
  });
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport({ ratio: 1 });
  await expect(
    freePlayerRow.getByRole('button', { name: 'Comprar', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expectNoPageOverflow();
  await actions.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeInViewport({ ratio: 1 });
  for (const name of [
    'Ver detalhes',
    'Editar',
    'Alterar condição',
    'Comprar',
    'Excluir',
  ]) {
    const item = menu.getByRole('menuitem', { name, exact: true });
    await expect(item).toBeEnabled();
    await expect(item).toBeInViewport({ ratio: 1 });
  }
  await expectNoPageOverflow();
  await page.screenshot({
    path: testInfo.outputPath('j08-mobile-actions.png'),
  });
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();

  await page.getByRole('button', { name: 'Novo jogador', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Novo jogador',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  const formBody = dialog.locator('form > div').first();
  const formSize = await formBody.evaluate((element) => ({
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(formSize.scrollHeight).toBeGreaterThan(formSize.height);
  expect(formSize.scrollWidth).toBeLessThanOrEqual(formSize.width);
  const documentScrollY = await page.evaluate(() => window.scrollY);
  const nameInput = dialog.getByRole('textbox', { name: 'Nome', exact: true });
  await nameInput.fill('Davi Melo');
  await expect(nameInput).toHaveValue('Davi Melo');
  for (const name of [
    'GOL Goleiro',
    'ZAG Zagueiro',
    'LAT Lateral',
    'MEI Meio-campo',
    'ATA Atacante',
  ]) {
    const position = dialog.getByRole('button', { name, exact: true });
    await position.scrollIntoViewIfNeeded();
    await expect(position).toBeInViewport({ ratio: 1 });
  }
  for (const name of [
    'Idade',
    'Agilidade',
    'Velocidade',
    'Finalização',
    'Passe',
    'Drible',
    'Defesa',
    'Físico',
    'Potencial',
  ]) {
    const input = dialog.getByRole('spinbutton', { name, exact: true });
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(input).toBeEditable();
  }
  const potential = dialog.getByRole('spinbutton', {
    name: 'Potencial',
    exact: true,
  });
  await potential.fill('82');
  await expect(potential).toHaveValue('82');
  expect(
    await formBody.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(documentScrollY);
  const cancel = dialog.getByRole('button', { name: 'Cancelar', exact: true });
  const save = dialog.getByRole('button', {
    name: 'Salvar jogador',
    exact: true,
  });
  await expect(cancel).toBeInViewport({ ratio: 1 });
  await expect(save).toBeInViewport({ ratio: 1 });
  await expect(save).toBeEnabled();
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expectNoPageOverflow();
  await page.screenshot({ path: testInfo.outputPath('j05-mobile-create.png') });
  await cancel.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Novo jogador', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expectNoPageOverflow();
  expect(mutationRequests).toEqual([]);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test(`F02 prevents combining free players and a club at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const playerRequests: Record<string, string>[] = [];
    const documentRequests: string[] = [];
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentRequests.push(request.url());
      }
    });
    await page.route('**/api/v1/players?*', async (route) => {
      const params = new URL(route.request().url()).searchParams;
      playerRequests.push(Object.fromEntries(params));
      if (params.get('free') === 'true' && params.has('club_id')) {
        await route.fulfill({
          status: 400,
          json: { message: 'Filtros incompatíveis.' },
        });
        return;
      }
      if (params.get('limit') === '1') {
        const free = params.get('free');
        const total = free === 'true' ? 3 : free === 'false' ? 20 : 23;
        await route.fulfill({
          json: {
            data: [free === 'true' ? players[4] : players[0]],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          },
        });
        return;
      }
      if (params.get('club_id') === '1') {
        await route.fulfill({
          json: {
            data: [players[1], players[3]],
            meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
          },
        });
        return;
      }
      if (params.get('free') === 'true') {
        await route.fulfill({
          json: {
            data: [players[4], players[5], players[9]],
            meta: { page: 1, limit: 10, total_items: 3, total_pages: 1 },
          },
        });
        return;
      }
      await route.fallback();
    });

    async function expectNoPageOverflow() {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
    }

    await page.goto('/jogadores');
    const table = page.getByRole('table', { name: 'Jogadores', exact: true });
    const club = page.getByRole('combobox', { name: 'Clube', exact: true });
    const allTab = page.getByRole('tab', { name: /^Todos/ });
    const freeTab = page.getByRole('tab', { name: /^Livres/ });
    const assignedTab = page.getByRole('tab', { name: /^Em clubes/ });
    const tooltipMessage = '“Livres” não combina com o filtro por clube.';
    await expect(table).toBeVisible();
    await expect(allTab).toHaveText('Todos 23');
    await expect(freeTab).toHaveText(/^Livres\s*3$/);
    await expect(assignedTab).toHaveText('Em clubes 20');
    await expect(freeTab).toBeEnabled();
    await expect(club).toBeEnabled();
    await expectNoPageOverflow();

    await club.click();
    const clubOption = page.getByRole('option', {
      name: 'Águias FC',
      exact: true,
    });
    await expect(clubOption).toBeInViewport({ ratio: 1 });
    await clubOption.click();
    await expect(page.getByText('Mostrando 1–2 de 2 jogadores')).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(3);
    await expect(
      table.getByRole('cell').filter({ hasText: 'Bruno Tavares' }),
    ).toBeVisible();
    await expect(
      table.getByRole('cell').filter({ hasText: 'Diego Ramos' }),
    ).toBeVisible();
    await expect(
      table.getByRole('cell').filter({ hasText: 'Eduardo Paiva' }),
    ).toHaveCount(0);
    await expect(allTab).toHaveText('Todos 2');
    await expect(assignedTab).toHaveText('Em clubes 2');
    await expect(freeTab).toBeDisabled();
    await expect(freeTab).toHaveText('Livres');
    await expect(club).toHaveText('Águias FC');
    const requestsBeforeBlockedTab = playerRequests.length;
    const freeTooltipTrigger = freeTab.locator('..');
    await freeTooltipTrigger.focus();
    await expect(page.getByRole('tooltip')).toHaveText(tooltipMessage);
    await expect(page.getByRole('tooltip')).toBeInViewport({ ratio: 1 });
    await freeTooltipTrigger.press('Enter');
    await freeTooltipTrigger.press('Space');
    await expect(allTab).toHaveAttribute('aria-selected', 'true');
    await expect(club).toHaveText('Águias FC');
    await expectNoPageOverflow();
    await page.screenshot({
      path: testInfo.outputPath('m06-club-filter.png'),
      fullPage: true,
    });
    expect(playerRequests).toHaveLength(requestsBeforeBlockedTab);

    const removeClub = page.getByRole('button', {
      name: 'Remover filtro Clube: Águias FC',
      exact: true,
    });
    await removeClub.scrollIntoViewIfNeeded();
    await expect(removeClub).toBeInViewport({ ratio: 1 });
    await removeClub.click();
    await expect(
      page.getByText('Mostrando 1–10 de 23 jogadores'),
    ).toBeVisible();
    await expect(freeTab).toBeEnabled();
    await expect(freeTab).toHaveText(/^Livres\s*3$/);
    await expect(allTab).toHaveText('Todos 23');
    await expect(assignedTab).toHaveText('Em clubes 20');
    await expect(club).toHaveText('Clube');
    await expect(removeClub).toHaveCount(0);

    await freeTab.click();
    await expect(page.getByText('Mostrando 1–3 de 3 jogadores')).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(4);
    for (const name of ['Eduardo Paiva', 'Ênio Carvalho', 'Ícaro Mendes']) {
      await expect(
        table.getByRole('cell').filter({ hasText: name }),
      ).toBeVisible();
    }
    await expect(
      table.getByRole('cell').filter({ hasText: 'Bruno Tavares' }),
    ).toHaveCount(0);
    await expect(freeTab).toHaveAttribute('aria-selected', 'true');
    await expect(club).toBeDisabled();
    const requestsBeforeBlockedClub = playerRequests.length;
    const clubTooltipTrigger = club.locator('..');
    await clubTooltipTrigger.scrollIntoViewIfNeeded();
    await clubTooltipTrigger.focus();
    await expect(page.getByRole('tooltip')).toHaveText(tooltipMessage);
    await expect(page.getByRole('tooltip')).toBeInViewport({ ratio: 1 });
    await clubTooltipTrigger.press('Enter');
    await clubTooltipTrigger.press('Space');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(freeTab).toHaveAttribute('aria-selected', 'true');
    await expect(club).toHaveText('Clube');
    await expectNoPageOverflow();
    await page.screenshot({
      path: testInfo.outputPath('j04-free-filter.png'),
      fullPage: true,
    });
    expect(playerRequests).toHaveLength(requestsBeforeBlockedClub);

    await allTab.click();
    await expect(club).toBeEnabled();
    await expect(allTab).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByText('Mostrando 1–10 de 23 jogadores'),
    ).toBeVisible();
    await expectNoPageOverflow();
    const tableRequests = playerRequests.filter(({ limit }) => limit === '10');
    expect(tableRequests).toContainEqual({
      page: '1',
      limit: '10',
      club_id: '1',
    });
    expect(tableRequests).toContainEqual({
      page: '1',
      limit: '10',
      free: 'true',
    });
    expect(
      playerRequests.some(
        ({ free, club_id }) => free === 'true' && club_id !== undefined,
      ),
    ).toBe(false);
    expect(documentRequests).toHaveLength(1);
  });
}
