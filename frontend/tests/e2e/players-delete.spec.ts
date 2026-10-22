import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PlayerListItem } from '../../src/types/player';

const target: PlayerListItem = {
  id: 9,
  name: 'Zeca Meia',
  position: 'MEI',
  age: 23,
  agility: 70,
  condition: 'APTO',
  club_id: null,
  overall: 68,
  base_value: 26.4,
  market_value: 37.15,
};
const assigned: PlayerListItem = {
  id: 1,
  name: 'Ana Costa',
  position: 'GOL',
  age: 30,
  agility: 25,
  condition: 'MAL_CONDICIONADO',
  club_id: 1,
  overall: 73,
  base_value: 36.5,
  market_value: 27.37,
};
const firstPage = [
  'Ana Alves',
  'Ana Braga',
  'Ana Costa',
  'Ana Dias',
  'Ana Esteves',
  'Ana Freitas',
  'Ana Gomes',
  'Ana Lima',
  'Ana Melo',
  'Ana Nunes',
].map((name, index) => ({ ...assigned, id: index + 20, name }));
type Mode = 'standard' | 'only' | 'last-page';
interface Reply {
  status: number;
  message?: string;
  deleteGate?: Promise<void>;
  refreshGate?: Promise<void>;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function mockApi(page: Page, mode: Mode) {
  const deletes: Array<{ path: string; body: string | null }> = [];
  const reads: Array<Record<string, string>> = [];
  const replies: Reply[] = [];
  const unexpected: string[] = [];
  const documents: string[] = [];
  const config = {
    standard: {
      assigned: [assigned],
      before: [assigned, target],
      total: 2,
      assignedTotal: 1,
      pages: 1,
    },
    only: {
      assigned: [],
      before: [target],
      total: 1,
      assignedTotal: 0,
      pages: 1,
    },
    'last-page': {
      assigned: firstPage,
      before: firstPage,
      total: 11,
      assignedTotal: 10,
      pages: 2,
    },
  }[mode];
  let deleted = false;
  let refreshGate: Promise<void> | undefined;
  let clubs = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'DELETE') {
      deletes.push({ path: url.pathname, body: request.postData() });
      const reply = replies.shift();
      if (url.pathname !== '/api/v1/players/9' || !reply) {
        unexpected.push(`DELETE inesperado: ${url.pathname}`);
        await route.fulfill({
          status: 500,
          json: { message: 'DELETE inesperado.' },
        });
        return;
      }
      if (reply.deleteGate) await reply.deleteGate;
      if (reply.status === 204) {
        deleted = true;
        refreshGate = reply.refreshGate;
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({
          status: reply.status,
          json: { message: reply.message },
        });
      }
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      clubs += 1;
      await route.fulfill({
        json: [{ id: 1, name: 'Águias FC', acronym: 'AGU' }],
      });
      return;
    }
    const query = Object.fromEntries(url.searchParams);
    const allowed =
      request.method() === 'GET' &&
      url.pathname === '/api/v1/players' &&
      ['1', '10'].includes(query.limit) &&
      (query.page === '1' ||
        (mode === 'last-page' && query.page === '2' && query.limit === '10')) &&
      (query.free === undefined || ['true', 'false'].includes(query.free)) &&
      Object.keys(query).every((key) =>
        ['page', 'limit', 'free'].includes(key),
      );
    if (!allowed) {
      unexpected.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 400,
        json: { message: 'Consulta inesperada.' },
      });
      return;
    }
    reads.push(query);
    // Totais e páginas declarados para cada estado; nenhum filtro de domínio é calculado.
    const all = deleted
      ? {
          data: config.assigned,
          total: config.assignedTotal,
          pages: mode === 'only' ? 0 : 1,
        }
      : { data: config.before, total: config.total, pages: config.pages };
    const free = deleted
      ? { data: [], total: 0, pages: 0 }
      : { data: [target], total: 1, pages: 1 };
    const linked = {
      data: config.assigned,
      total: config.assignedTotal,
      pages: mode === 'only' ? 0 : 1,
    };
    const result =
      query.free === 'true' ? free : query.free === 'false' ? linked : all;
    const data =
      query.page === '2'
        ? deleted
          ? []
          : [target]
        : query.limit === '1'
          ? result.data.slice(0, 1)
          : result.data;
    if (refreshGate) await refreshGate;
    await route.fulfill({
      json: {
        data,
        meta: {
          page: Number(query.page),
          limit: Number(query.limit),
          total_items: result.total,
          total_pages: query.limit === '1' ? result.total : result.pages,
        },
      },
    });
  });
  return {
    deletes,
    reads,
    clubRequests: () => clubs,
    reply: (value: Reply) => replies.push(value),
    expectDeletes(count: number) {
      expect(deletes).toEqual(
        Array.from({ length: count }, () => ({
          path: '/api/v1/players/9',
          body: null,
        })),
      );
    },
    async expectEnd(width: number) {
      expect(unexpected).toEqual([]);
      expect(replies).toHaveLength(0);
      expect(documents).toHaveLength(1);
      await expectLayout(page, width);
    },
  };
}

async function expectLayout(page: Page, width: number) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await expect(
    page.getByRole('main', { includeHidden: true }),
  ).toHaveJSProperty('scrollLeft', 0);
}

async function expectCounts(page: Page, counts: [number, number, number]) {
  for (const [index, label] of ['Todos', 'Livres', 'Em clubes'].entries())
    await expect(
      page.getByRole('tab', {
        name: new RegExp(`^${label}`),
        includeHidden: true,
      }),
    ).toHaveText(new RegExp(`^${label}\\s*${counts[index]}$`));
}

async function start(page: Page, mode: Mode = 'standard') {
  const api = await mockApi(page, mode);
  await page.goto('/jogadores');
  await expect(
    page
      .getByRole('table', { name: 'Jogadores', exact: true })
      .getByRole('row'),
  ).toHaveCount(mode === 'last-page' ? 11 : mode === 'only' ? 2 : 3);
  await expectCounts(
    page,
    mode === 'last-page'
      ? [11, 1, 10]
      : mode === 'only'
        ? [1, 1, 0]
        : [2, 1, 1],
  );
  return api;
}

async function openMenu(page: Page, player: PlayerListItem, width: number) {
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, {
    timeout: 10_000,
  });
  const actions = page.getByRole('button', {
    name: `Abrir ações de ${player.name}`,
    exact: true,
  });
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport({ ratio: 1 });
  await expectLayout(page, width);
  await actions.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeInViewport({ ratio: 1 });
  return menu;
}

async function openDelete(page: Page, width: number) {
  const menu = await openMenu(page, target, width);
  const remove = menu.getByRole('menuitem', { name: 'Excluir', exact: true });
  await expect(remove).toBeInViewport({ ratio: 1 });
  await remove.click();
  const dialog = page.getByRole('dialog', {
    name: 'Excluir jogador?',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog).toContainText(
    'Zeca Meia deixará de aparecer na lista. Esta ação não pode ser desfeita pela interface.',
  );
  for (const name of ['Cancelar', 'Excluir jogador', 'Fechar']) {
    const action = dialog.getByRole('button', { name, exact: true });
    await expect(action).toBeEnabled();
    await expect(action).toBeInViewport({ ratio: 1 });
  }
  await expectLayout(page, width);
  return dialog;
}

function confirm(dialog: Locator) {
  return dialog.getByRole('button', {
    name: /^(Excluir jogador|Excluindo\.\.\.)$/,
  });
}

async function expectSuccess(page: Page) {
  await expect(
    page.getByRole('dialog', { name: 'Excluir jogador?', exact: true }),
  ).toHaveCount(0);
  const toast = page.locator('[data-sonner-toast]');
  await expect(
    toast.getByText('Jogador excluído', { exact: true }),
  ).toBeVisible();
  await expect(
    toast.getByText('Zeca Meia não aparecerá mais na lista.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Abrir ações de Zeca Meia', exact: true }),
  ).toHaveCount(0);
}

async function expectRemaining(page: Page, width: number) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table.getByRole('row')).toHaveCount(2);
  const row = table.getByRole('row').nth(1);
  const values = [
    'Ana Costa',
    'GOL',
    '73',
    '25',
    '30',
    'Mal condicionado',
    '36,50',
    '27,37',
    'Águias FC',
  ];
  for (const [index, value] of values.entries()) {
    if (index === 0 || index === 8)
      await expect(row.getByRole('cell').nth(index)).toContainText(value);
    else await expect(row.getByRole('cell').nth(index)).toHaveText(value);
  }
  await expectCounts(page, [1, 0, 1]);
  await expect(
    page.getByText('Mostrando 1–1 de 1 jogador', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Anterior', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Próxima', exact: true }),
  ).toBeDisabled();
  if (width === 375) {
    const container = table.locator('..');
    expect(
      await container.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    await row.getByRole('cell').nth(8).scrollIntoViewIfNeeded();
    await expect(row.getByRole('cell').nth(8)).toBeInViewport({ ratio: 1 });
    expect(
      await container.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0);
    await container.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  await expectLayout(page, width);
}

async function expectEmpty(page: Page) {
  await expect(
    page.getByRole('table', { name: 'Jogadores', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Paginação de jogadores' }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Nenhum jogador encontrado', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Novo jogador', exact: true }),
  ).toBeEnabled();
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test.describe(`F03 player deletion at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('offers deletion only for free players and requires confirmation without requests on dismissal', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const menu = await openMenu(page, assigned, viewport.width);
      await expect(
        menu.getByRole('menuitem', { name: 'Excluir', exact: true }),
      ).toHaveCount(0);
      await page.keyboard.press('Escape');
      const beforeReads = api.reads.length;
      const beforeClubs = api.clubRequests();
      for (const action of ['Cancelar', 'Fechar', 'Escape', 'outside']) {
        const dialog = await openDelete(page, viewport.width);
        api.expectDeletes(0);
        if (action === 'Cancelar')
          await page.screenshot({
            path: testInfo.outputPath('delete-confirmation.png'),
            fullPage: true,
          });
        if (action === 'Escape') await page.keyboard.press('Escape');
        else if (action === 'outside') await page.mouse.click(2, 2);
        else
          await dialog
            .getByRole('button', { name: action, exact: true })
            .click();
        await expect(dialog).toHaveCount(0);
        api.expectDeletes(0);
        await expect(
          page
            .getByRole('table', { name: 'Jogadores', exact: true })
            .getByRole('row'),
        ).toHaveCount(3);
        await expectCounts(page, [2, 1, 1]);
      }
      expect(api.reads).toHaveLength(beforeReads);
      expect(api.clubRequests()).toBe(beforeClubs);
      await expect(
        page.getByText('Jogador excluído', { exact: true }),
      ).toHaveCount(0);
      await api.expectEnd(viewport.width);
    });

    for (const variant of ['filtered', 'last-page', 'only'] as const) {
      test(`deletes with an empty 204 and updates ${variant} results and pagination without reload`, async ({
        page,
      }, testInfo) => {
        const mode = variant === 'filtered' ? 'standard' : variant;
        const api = await start(page, mode);
        if (variant === 'filtered') {
          await page.getByRole('tab', { name: /^Livres/ }).click();
          await expect(
            page
              .getByRole('table', { name: 'Jogadores', exact: true })
              .getByRole('row'),
          ).toHaveCount(2);
        } else if (variant === 'last-page') {
          await page
            .getByRole('button', { name: 'Próxima', exact: true })
            .click();
          await expect(
            page.getByRole('button', { name: 'Página 2', exact: true }),
          ).toHaveAttribute('aria-current', 'page');
          await expect(
            page.getByText('Mostrando 11–11 de 11 jogadores', { exact: true }),
          ).toBeVisible();
        }
        const dialog = await openDelete(page, viewport.width);
        const beforeReads = api.reads.length;
        api.reply({ status: 204 });
        await confirm(dialog).click();
        await expectSuccess(page);
        api.expectDeletes(1);
        expect(api.reads.length).toBeGreaterThan(beforeReads);
        if (variant === 'filtered') {
          await expectEmpty(page);
          await expectCounts(page, [1, 0, 1]);
          await expect(
            page.getByRole('tab', { name: /^Livres/ }),
          ).toHaveAttribute('aria-selected', 'true');
          await expect(
            page.getByText('Tente ajustar ou remover alguns filtros.', {
              exact: true,
            }),
          ).toBeVisible();
          expect(api.reads.slice(beforeReads)).toContainEqual({
            page: '1',
            limit: '10',
            free: 'true',
          });
          await page.screenshot({
            path: testInfo.outputPath('deleted-filtered-empty.png'),
            fullPage: true,
          });
          await page.getByRole('tab', { name: /^Todos/ }).click();
          await expectRemaining(page, viewport.width);
        } else if (variant === 'last-page') {
          const table = page.getByRole('table', {
            name: 'Jogadores',
            exact: true,
          });
          await expect(table.getByRole('row')).toHaveCount(11);
          for (const [index, player] of firstPage.entries())
            await expect(
              table
                .getByRole('row')
                .nth(index + 1)
                .getByRole('cell')
                .first(),
            ).toContainText(player.name);
          await expectCounts(page, [10, 0, 10]);
          await expect(
            page.getByText('Mostrando 1–10 de 10 jogadores', { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: 'Página 1', exact: true }),
          ).toHaveAttribute('aria-current', 'page');
          await expect(
            page.getByRole('button', { name: 'Página 2', exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByRole('button', { name: 'Anterior', exact: true }),
          ).toBeDisabled();
          await expect(
            page.getByRole('button', { name: 'Próxima', exact: true }),
          ).toBeDisabled();
          expect(api.reads.slice(beforeReads)).toContainEqual({
            page: '2',
            limit: '10',
          });
          expect(api.reads.slice(beforeReads)).toContainEqual({
            page: '1',
            limit: '10',
          });
        } else {
          await expectEmpty(page);
          await expectCounts(page, [0, 0, 0]);
          await expect(
            page.getByText('Os jogadores cadastrados aparecerão aqui.', {
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: 'Limpar filtros', exact: true }),
          ).toHaveCount(0);
        }
        for (const query of [
          { page: '1', limit: '1' },
          { page: '1', limit: '1', free: 'true' },
          { page: '1', limit: '1', free: 'false' },
        ])
          expect(api.reads.slice(beforeReads)).toContainEqual(query);
        await page.screenshot({
          path: testInfo.outputPath(`deleted-${variant}.png`),
          fullPage: true,
        });
        await api.expectEnd(viewport.width);
      });
    }

    for (const refusal of [
      { status: 404, message: 'Jogador não encontrado ou já excluído.' },
      {
        status: 409,
        message: 'O jogador passou a ter clube e não pode ser excluído.',
      },
    ]) {
      test(`shows the exact ${refusal.status} message, keeps the list and retries deletion`, async ({
        page,
      }, testInfo) => {
        const api = await start(page);
        const dialog = await openDelete(page, viewport.width);
        const beforeReads = api.reads.length;
        const beforeClubs = api.clubRequests();
        api.reply(refusal);
        await confirm(dialog).click();
        const alert = dialog.getByRole('alert');
        await expect(
          alert.getByText('Não foi possível excluir o jogador', {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          alert.locator('[data-slot="alert-description"]'),
        ).toHaveText(refusal.message);
        await expect(alert).toBeInViewport({ ratio: 1 });
        await expect(confirm(dialog)).toBeEnabled();
        await expect(
          dialog.getByRole('button', { name: 'Cancelar', exact: true }),
        ).toBeEnabled();
        await expect(dialog).toContainText(target.name);
        await expect(
          page.getByText('Jogador excluído', { exact: true }),
        ).toHaveCount(0);
        const table = page.locator('table[aria-label="Jogadores"]');
        await expect(table.locator('tr')).toHaveCount(3);
        const row = table.locator('tbody tr').filter({ hasText: target.name });
        await expect(row.locator('td').nth(7)).toHaveText('37,15');
        await expect(row.locator('td').nth(8)).toContainText('Livre');
        await expectCounts(page, [2, 1, 1]);
        expect(api.reads).toHaveLength(beforeReads);
        expect(api.clubRequests()).toBe(beforeClubs);
        api.expectDeletes(1);
        await expectLayout(page, viewport.width);
        await page.screenshot({
          path: testInfo.outputPath(`delete-error-${refusal.status}.png`),
          fullPage: true,
        });
        api.reply({ status: 204 });
        await confirm(dialog).click();
        await expectSuccess(page);
        await expect(
          page.getByText(refusal.message, { exact: true }),
        ).toHaveCount(0);
        await expectRemaining(page, viewport.width);
        api.expectDeletes(2);
        await api.expectEnd(viewport.width);
      });
    }

    for (const click of ['click', 'dblclick'] as const) {
      test(`sends one DELETE after ${click} and blocks controls and dismissal until refresh completes`, async ({
        page,
      }, testInfo) => {
        const api = await start(page);
        const dialog = await openDelete(page, viewport.width);
        const removal = gate();
        const refresh = gate();
        api.reply({
          status: 204,
          deleteGate: removal.promise,
          refreshGate: refresh.promise,
        });
        const remove = confirm(dialog);
        const cancel = dialog.getByRole('button', {
          name: 'Cancelar',
          exact: true,
        });
        const beforeReads = api.reads.length;
        const beforeClubs = api.clubRequests();
        try {
          await remove[click]();
          await expect.poll(() => api.deletes.length).toBe(1);
          await expect(remove).toBeDisabled();
          await expect(remove).toHaveText('Excluindo...');
          await expect(cancel).toBeDisabled();
          await page.keyboard.press('Escape');
          await page.mouse.click(2, 2);
          await dialog
            .getByRole('button', { name: 'Fechar', exact: true })
            .click();
          await expect(dialog).toBeVisible();
          await expect(
            page.getByText('Jogador excluído', { exact: true }),
          ).toHaveCount(0);
          api.expectDeletes(1);
          expect(api.reads).toHaveLength(beforeReads);
          await page.screenshot({
            path: testInfo.outputPath('delete-pending.png'),
            fullPage: true,
          });
          removal.release();
          await expect.poll(() => api.reads.length - beforeReads).toBe(4);
          await expect(remove).toBeDisabled();
          await expect(cancel).toBeDisabled();
          await expect(
            page.getByText('Jogador excluído', { exact: true }),
          ).toHaveCount(0);
          expect(api.clubRequests()).toBe(beforeClubs);
          refresh.release();
          await expectSuccess(page);
          await expectRemaining(page, viewport.width);
          api.expectDeletes(1);
          await api.expectEnd(viewport.width);
        } finally {
          removal.release();
          refresh.release();
          await testInfo.attach('delete-requests.json', {
            body: JSON.stringify(
              { deletes: api.deletes, reads: api.reads },
              null,
              2,
            ),
            contentType: 'application/json',
          });
        }
      });
    }
  });
}
