import { expect, test, type Page } from '@playwright/test';
import type {
  PlayerCondition,
  PlayerListItem,
  PlayerPosition,
} from '../../src/types/player';

function player(
  id: number,
  name: string,
  position: PlayerPosition,
  condition: PlayerCondition,
  club_id: number | null,
): PlayerListItem {
  return {
    id,
    name,
    position,
    condition,
    club_id,
    overall: 74,
    agility: 72,
    age: 24,
    base_value: 40,
    market_value: 37.15,
  };
}

const andre = player(1, 'André Lacerda', 'GOL', 'APTO', 1);
const bruno = player(2, 'Bruno Tavares', 'ZAG', 'MAL_CONDICIONADO', null);
const carlos = player(3, 'Carlos Freitas', 'LAT', 'DOENTE', 1);
const davi = player(4, 'Davi Melo', 'MEI', 'APTO', null);
const eduardo = player(5, 'Eduardo Paiva', 'ATA', 'MAL_CONDICIONADO', 1);
const joao = player(6, 'João Silva', 'ATA', 'APTO', 1);
const longSearch = 'a'.repeat(100);

interface Listing {
  data: PlayerListItem[];
  counts: [all: number, free: number, assigned: number];
  freeSample?: PlayerListItem;
  assignedSample?: PlayerListItem;
}

// Fixed API responses: the mock does not implement search or filtering rules.
const listings: Record<string, Listing> = {
  all: {
    data: [andre, bruno, carlos, davi, eduardo, joao],
    counts: [6, 2, 4],
    freeSample: bruno,
    assignedSample: andre,
  },
  joao: { data: [joao], counts: [1, 0, 1], assignedSample: joao },
  none: { data: [], counts: [0, 0, 0] },
  GOL: { data: [andre], counts: [1, 0, 1], assignedSample: andre },
  ZAG: { data: [bruno], counts: [1, 1, 0], freeSample: bruno },
  LAT: { data: [carlos], counts: [1, 0, 1], assignedSample: carlos },
  MEI: { data: [davi], counts: [1, 1, 0], freeSample: davi },
  ATA: { data: [eduardo, joao], counts: [2, 0, 2], assignedSample: eduardo },
  APTO: {
    data: [andre, davi, joao],
    counts: [3, 1, 2],
    freeSample: davi,
    assignedSample: andre,
  },
  MAL_CONDICIONADO: {
    data: [bruno, eduardo],
    counts: [2, 1, 1],
    freeSample: bruno,
    assignedSample: eduardo,
  },
  DOENTE: { data: [carlos], counts: [1, 0, 1], assignedSample: carlos },
  assigned: {
    data: [andre, carlos, eduardo, joao],
    counts: [4, 0, 4],
    assignedSample: andre,
  },
};

async function mockListings(page: Page) {
  const requests: Record<string, string>[] = [];
  const unexpected: string[] = [];
  const navigations: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigations.push(request.url());
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({
        json: [{ id: 1, name: 'Águias FC', acronym: 'AGU' }],
      });
      return;
    }
    if (request.method() !== 'GET' || url.pathname !== '/api/v1/players') {
      unexpected.push(`${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    const params = Object.fromEntries(url.searchParams);
    requests.push(params);
    const { search, position, condition, free, limit } = params;
    const searchKeys: Record<string, string> = {
      jo: 'joao',
      joao: 'joao',
      JOÃO: 'joao',
      [longSearch]: 'none',
    };
    const key =
      search !== undefined
        ? searchKeys[search]
        : (position ??
          condition ??
          (free === 'false' && limit === '10' ? 'assigned' : 'all'));
    const listing = listings[key];
    if (!listing || !['1', '10'].includes(limit) || params.page !== '1') {
      unexpected.push(request.url());
      await route.fulfill({
        status: 400,
        json: { message: 'Consulta não prevista neste cenário.' },
      });
      return;
    }
    if (limit === '1') {
      const total =
        listing.counts[free === 'true' ? 1 : free === 'false' ? 2 : 0];
      const sample =
        free === 'true'
          ? listing.freeSample
          : free === 'false'
            ? listing.assignedSample
            : listing.data[0];
      await route.fulfill({
        json: {
          data: sample ? [sample] : [],
          meta: { page: 1, limit: 1, total_items: total, total_pages: total },
        },
      });
      return;
    }
    const total = listing.counts[0];
    await route.fulfill({
      json: {
        data: listing.data,
        meta: {
          page: 1,
          limit: 10,
          total_items: total,
          total_pages: total === 0 ? 0 : 1,
        },
      },
    });
  });
  return {
    requests,
    tableRequests: () => requests.filter(({ limit }) => limit === '10'),
    async expectFinished(width: number) {
      expect(unexpected).toEqual([]);
      expect(navigations).toHaveLength(1);
      for (const request of requests) {
        expect(request.page).toBe('1');
        expect(Object.values(request)).not.toContain('');
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
    },
  };
}

async function expectView(
  page: Page,
  names: string[],
  counts: [number, number, number],
  total = counts[0],
) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table).toBeVisible();
  const rows = table.getByRole('row');
  await expect(rows).toHaveCount(names.length + 1);
  for (const [index, name] of names.entries()) {
    await expect(
      rows
        .nth(index + 1)
        .getByRole('cell')
        .first(),
    ).toContainText(name);
    await expect(
      rows
        .nth(index + 1)
        .getByRole('cell')
        .nth(7),
    ).toHaveText('37,15');
  }
  await expect(page.getByRole('tab', { name: /^Todos/ })).toHaveText(
    `Todos ${counts[0]}`,
  );
  await expect(page.getByRole('tab', { name: /^Livres/ })).toHaveText(
    new RegExp(`^Livres\\s*${counts[1]}$`),
  );
  await expect(page.getByRole('tab', { name: /^Em clubes/ })).toHaveText(
    `Em clubes ${counts[2]}`,
  );
  await expect(
    page.getByText(
      `Mostrando 1–${names.length} de ${total} ${total === 1 ? 'jogador' : 'jogadores'}`,
      { exact: true },
    ),
  ).toBeVisible();
}

const allNames = [
  'André Lacerda',
  'Bruno Tavares',
  'Carlos Freitas',
  'Davi Melo',
  'Eduardo Paiva',
  'João Silva',
];

async function selectOption(page: Page, filter: string, option: string) {
  const trigger = page.getByRole('combobox', { name: filter, exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeInViewport({ ratio: 1 });
  await trigger.click();
  const choice = page.getByRole('option', { name: option, exact: true });
  await expect(choice).toBeInViewport({ ratio: 1 });
  await choice.click();
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test.describe(`F02 basic player filters at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('search respects debounce, bounds and API results without normalizing names locally', async ({
      page,
    }, testInfo) => {
      const instant = new Date('2026-10-21T15:00:00Z');
      await page.clock.install({ time: instant });
      const api = await mockListings(page);
      await page.goto('/jogadores');
      await expectView(page, allNames, [6, 2, 4]);
      await page.clock.pauseAt(new Date('2026-10-21T16:00:00Z'));
      const search = page.getByRole('textbox', {
        name: 'Buscar por nome',
        exact: true,
      });
      await expect(search).toBeInViewport({ ratio: 1 });
      const initialRequests = api.requests.length;

      await search.fill('j');
      await page.clock.runFor(400);
      await expect(
        page.getByText('Digite pelo menos 2 caracteres para buscar.', {
          exact: true,
        }),
      ).toBeVisible();
      expect(api.requests).toHaveLength(initialRequests);
      await search.fill('   ');
      await page.clock.runFor(400);
      expect(api.requests).toHaveLength(initialRequests);

      await search.fill('  jo');
      await page.clock.runFor(200);
      await search.fill('  joao  ');
      await page.clock.runFor(349);
      expect(api.requests).toHaveLength(initialRequests);
      await page.clock.runFor(1);
      await page.clock.resume();
      await expectView(page, ['João Silva'], [1, 0, 1]);
      expect(api.tableRequests()).toEqual([
        { page: '1', limit: '10' },
        { page: '1', limit: '10', search: 'joao' },
      ]);
      await expect(
        page.getByRole('button', {
          name: 'Remover filtro Busca: joao',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText('Digite pelo menos 2 caracteres para buscar.', {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(api.requests.some(({ search }) => search === 'jo')).toBe(false);
      for (const free of [undefined, 'true', 'false']) {
        expect(api.requests).toContainEqual({
          search: 'joao',
          page: '1',
          limit: '1',
          ...(free === undefined ? {} : { free }),
        });
      }
      await api.expectFinished(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('j03-search.png'),
        fullPage: true,
      });

      for (const value of ['jo', 'JOÃO']) {
        await search.fill(value);
        await page.clock.runFor(350);
        await expect(
          page.getByRole('button', {
            name: `Remover filtro Busca: ${value}`,
            exact: true,
          }),
        ).toBeVisible();
        await expectView(page, ['João Silva'], [1, 0, 1]);
        expect(api.tableRequests()).toContainEqual({
          page: '1',
          limit: '10',
          search: value,
        });
      }
      await search.fill('j');
      await page.clock.runFor(350);
      await expectView(page, allNames, [6, 2, 4]);
      await expect(
        page.getByRole('button', { name: /^Remover filtro Busca:/ }),
      ).toHaveCount(0);
      expect(
        api.requests.some(({ search }) => search === 'j' || search === ''),
      ).toBe(false);
      await search.fill('');
      await page.clock.runFor(400);
      await expect(search).toHaveValue('');
      await expect(
        page.getByText('Digite pelo menos 2 caracteres para buscar.', {
          exact: true,
        }),
      ).toHaveCount(0);

      await expect(search).toHaveAttribute('maxlength', '100');
      await search.fill(`${longSearch}x`);
      await expect(search).toHaveValue(longSearch);
      await page.clock.runFor(350);
      await expect(
        page.getByText(`Nenhum jogador encontrado para “${longSearch}”`, {
          exact: true,
        }),
      ).toBeVisible();
      expect(api.tableRequests()).toContainEqual({
        page: '1',
        limit: '10',
        search: longSearch,
      });
      const requestsAtMaxLength = api.requests.length;
      await search.press('End');
      await search.press('x');
      await page.clock.runFor(400);
      await expect(search).toHaveValue(longSearch);
      expect(api.requests).toHaveLength(requestsAtMaxLength);
      const removeLongSearch = page.getByRole('button', {
        name: `Remover filtro Busca: ${longSearch}`,
        exact: true,
      });
      await removeLongSearch.scrollIntoViewIfNeeded();
      await expect(removeLongSearch).toBeInViewport({ ratio: 1 });
      await api.expectFinished(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('search-max-length.png'),
        fullPage: true,
      });
      await expect(page.getByRole('main')).toHaveJSProperty('scrollLeft', 0);
      await expect(search).toBeInViewport({ ratio: 1 });
      await search.clear();
      await page.clock.runFor(350);
      await expectView(page, allNames, [6, 2, 4]);
      await api.expectFinished(viewport.width);
    });

    test('position options send their API codes and replace rows and counters', async ({
      page,
    }, testInfo) => {
      const api = await mockListings(page);
      await page.goto('/jogadores');
      await expectView(page, allNames, [6, 2, 4]);
      const cases: Array<{
        code: PlayerPosition;
        label: string;
        names: string[];
        counts: [number, number, number];
      }> = [
        {
          code: 'GOL',
          label: 'Goleiro',
          names: ['André Lacerda'],
          counts: [1, 0, 1],
        },
        {
          code: 'ZAG',
          label: 'Zagueiro',
          names: ['Bruno Tavares'],
          counts: [1, 1, 0],
        },
        {
          code: 'LAT',
          label: 'Lateral',
          names: ['Carlos Freitas'],
          counts: [1, 0, 1],
        },
        {
          code: 'MEI',
          label: 'Meio-campo',
          names: ['Davi Melo'],
          counts: [1, 1, 0],
        },
        {
          code: 'ATA',
          label: 'Atacante',
          names: ['Eduardo Paiva', 'João Silva'],
          counts: [2, 0, 2],
        },
      ];
      for (const { code, label, names, counts } of cases) {
        await selectOption(page, 'Posição', label);
        await expectView(page, names, counts);
        await expect(
          page.getByRole('combobox', { name: 'Posição', exact: true }),
        ).toHaveText(label);
        await expect(
          page.getByRole('button', {
            name: `Remover filtro Posição: ${label}`,
            exact: true,
          }),
        ).toBeVisible();
        expect(api.tableRequests()).toContainEqual({
          position: code,
          page: '1',
          limit: '10',
        });
        for (const free of [undefined, 'true', 'false']) {
          expect(api.requests).toContainEqual({
            position: code,
            page: '1',
            limit: '1',
            ...(free === undefined ? {} : { free }),
          });
        }
        await api.expectFinished(viewport.width);
      }
      await page.screenshot({
        path: testInfo.outputPath('position-filter.png'),
        fullPage: true,
      });
      await selectOption(page, 'Posição', 'Todas as posições');
      await expectView(page, allNames, [6, 2, 4]);
      await expect(
        page.getByRole('button', { name: /^Remover filtro Posição:/ }),
      ).toHaveCount(0);
      expect(
        api.tableRequests().filter(({ position }) => position !== undefined),
      ).toEqual(
        cases.map(({ code }) => ({ position: code, page: '1', limit: '10' })),
      );
      await api.expectFinished(viewport.width);
    });

    test('condition options send their API codes and replace rows and counters', async ({
      page,
    }, testInfo) => {
      const api = await mockListings(page);
      await page.goto('/jogadores');
      await expectView(page, allNames, [6, 2, 4]);
      const cases: Array<{
        code: PlayerCondition;
        label: string;
        names: string[];
        counts: [number, number, number];
      }> = [
        {
          code: 'APTO',
          label: 'Apto',
          names: ['André Lacerda', 'Davi Melo', 'João Silva'],
          counts: [3, 1, 2],
        },
        {
          code: 'MAL_CONDICIONADO',
          label: 'Mal condicionado',
          names: ['Bruno Tavares', 'Eduardo Paiva'],
          counts: [2, 1, 1],
        },
        {
          code: 'DOENTE',
          label: 'Doente',
          names: ['Carlos Freitas'],
          counts: [1, 0, 1],
        },
      ];
      for (const { code, label, names, counts } of cases) {
        await selectOption(page, 'Condição', label);
        await expectView(page, names, counts);
        await expect(
          page.getByRole('combobox', { name: 'Condição', exact: true }),
        ).toHaveText(`Condição: ${label}`);
        await expect(
          page.getByRole('button', {
            name: `Remover filtro Condição: ${label}`,
            exact: true,
          }),
        ).toBeVisible();
        expect(api.tableRequests()).toContainEqual({
          condition: code,
          page: '1',
          limit: '10',
        });
        for (const free of [undefined, 'true', 'false']) {
          expect(api.requests).toContainEqual({
            condition: code,
            page: '1',
            limit: '1',
            ...(free === undefined ? {} : { free }),
          });
        }
        await api.expectFinished(viewport.width);
      }
      await page.screenshot({
        path: testInfo.outputPath('condition-filter.png'),
        fullPage: true,
      });
      await selectOption(page, 'Condição', 'Todas as condições');
      await expectView(page, allNames, [6, 2, 4]);
      await expect(
        page.getByRole('button', { name: /^Remover filtro Condição:/ }),
      ).toHaveCount(0);
      expect(
        api.tableRequests().filter(({ condition }) => condition !== undefined),
      ).toEqual(
        cases.map(({ code }) => ({ condition: code, page: '1', limit: '10' })),
      );
      await api.expectFinished(viewport.width);
    });

    test('assigned tab sends free=false and restores all players without reload', async ({
      page,
    }, testInfo) => {
      const api = await mockListings(page);
      await page.goto('/jogadores');
      await expectView(page, allNames, [6, 2, 4]);
      const assigned = page.getByRole('tab', { name: /^Em clubes/ });
      await assigned.scrollIntoViewIfNeeded();
      await expect(assigned).toBeInViewport({ ratio: 1 });
      await assigned.click();
      await expectView(
        page,
        ['André Lacerda', 'Carlos Freitas', 'Eduardo Paiva', 'João Silva'],
        [6, 2, 4],
        4,
      );
      await expect(assigned).toHaveAttribute('aria-selected', 'true');
      await expect(
        page.getByRole('combobox', { name: 'Clube', exact: true }),
      ).toBeEnabled();
      const table = page.getByRole('table', { name: 'Jogadores', exact: true });
      await expect(
        table.getByRole('cell').filter({ hasText: 'Livre' }),
      ).toHaveCount(0);
      await expect(
        table.getByRole('cell').filter({ hasText: 'Águias FC' }),
      ).toHaveCount(4);
      expect(api.tableRequests()).toEqual([
        { page: '1', limit: '10' },
        { page: '1', limit: '10', free: 'false' },
      ]);
      await api.expectFinished(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('assigned-tab.png'),
        fullPage: true,
      });
      await page.getByRole('tab', { name: /^Todos/ }).click();
      await expectView(page, allNames, [6, 2, 4]);
      await expect(page.getByRole('tab', { name: /^Todos/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(assigned).toHaveAttribute('aria-selected', 'false');
      await api.expectFinished(viewport.width);
    });
  });
}
