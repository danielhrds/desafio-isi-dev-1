import { expect, test, type Page } from '@playwright/test';
import type {
  PlayerListItem,
  PlayerListResponse,
} from '../../src/types/player';

type Query = Record<string, string>;
interface View {
  response: PlayerListResponse;
  counts: [number, number, number];
}
const ana: PlayerListItem = {
  id: 1,
  name: 'Ana Costa',
  position: 'GOL',
  condition: 'APTO',
  age: 33,
  agility: 72,
  overall: 74,
  base_value: 90,
  market_value: 20,
  club_id: null,
};
const bruno: PlayerListItem = {
  ...ana,
  id: 2,
  name: 'Bruno Meia',
  position: 'MEI',
  condition: 'MAL_CONDICIONADO',
  age: 22,
  base_value: 52,
  market_value: 48.1,
  club_id: 1,
};
const carla: PlayerListItem = {
  ...bruno,
  id: 3,
  name: 'Carla Meia',
  age: 25,
  base_value: 38,
  market_value: 32.3,
  club_id: null,
};
const davi: PlayerListItem = {
  ...ana,
  id: 4,
  name: 'Davi Ramos',
  position: 'ATA',
  condition: 'DOENTE',
  age: 19,
  base_value: 24,
  market_value: 14.4,
  club_id: 2,
};
const baseRows = [ana, bruno, carla, davi];
function view(
  data: PlayerListItem[],
  counts: View['counts'],
  page = 1,
  total = counts[0],
  pages = 1,
): View {
  return {
    response: {
      data,
      meta: { page, limit: 10, total_items: total, total_pages: pages },
    },
    counts,
  };
}
const baseline = view(baseRows, [4, 2, 2]);
const pair = view([bruno, carla], [2, 1, 1]);
const linked = view([bruno], [1, 0, 1]);
const free = view([carla], [1, 1, 0]);
const sortCases = [
  {
    code: 'value_asc',
    label: 'menor valor de mercado',
    rows: [davi, ana, carla, bruno],
  },
  {
    code: 'value_desc',
    label: 'maior valor de mercado',
    rows: [bruno, carla, ana, davi],
  },
  { code: 'age_asc', label: 'menor idade', rows: [davi, bruno, carla, ana] },
  { code: 'age_desc', label: 'maior idade', rows: [ana, carla, bruno, davi] },
  { code: 'position', label: 'posição', rows: [ana, bruno, carla, davi] },
  { code: undefined, label: 'nome', rows: baseRows },
];

function key(query: Query) {
  return JSON.stringify(
    Object.entries(query).sort(([a], [b]) => a.localeCompare(b)),
  );
}

async function mockApi(page: Page) {
  const responses = new Map<string, PlayerListResponse>();
  const requests: Query[] = [];
  const unexpected: string[] = [];
  const documents: string[] = [];
  let clubs = [
    { id: 1, name: 'Águias FC', acronym: 'AGU' },
    { id: 2, name: 'Delta FC', acronym: 'DEL' },
  ];
  let clubRequests = 0;
  let gate: Promise<void> | undefined;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      unexpected.push(`${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    if (url.pathname === '/api/v1/clubs') {
      clubRequests += 1;
      const data = clubs;
      if (gate) await gate;
      await route.fulfill({ json: data });
      return;
    }
    const query = Object.fromEntries(url.searchParams);
    if (url.pathname !== '/api/v1/players' || !responses.has(key(query))) {
      unexpected.push(request.url());
      await route.fulfill({
        status: 400,
        json: { message: 'Consulta não prevista neste cenário.' },
      });
      return;
    }
    requests.push(query);
    const response = responses.get(key(query));
    if (gate) await gate;
    await route.fulfill({ json: response });
  });
  return {
    requests,
    mainRequests: () => requests.filter(({ limit }) => limit === '10'),
    clubRequests: () => clubRequests,
    setClubs: (value: typeof clubs) => {
      clubs = value;
    },
    hold() {
      let release!: () => void;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () => {
        gate = undefined;
        release();
      };
    },
    plan(query: Query, snapshot: View, counterFilters?: Query) {
      responses.set(
        key({ page: '1', ...query, limit: '10' }),
        snapshot.response,
      );
      if (counterFilters === undefined) return;
      for (const [index, variant] of [undefined, 'true', 'false'].entries()) {
        const sample =
          variant === 'true'
            ? snapshot.response.data.find(({ club_id }) => club_id === null)
            : variant === 'false'
              ? snapshot.response.data.find(({ club_id }) => club_id !== null)
              : snapshot.response.data[0];
        const total = snapshot.counts[index];
        responses.set(
          key({
            ...counterFilters,
            page: '1',
            limit: '1',
            ...(variant === undefined ? {} : { free: variant }),
          }),
          {
            data: total > 0 && sample ? [sample] : [],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          },
        );
      }
    },
    async expectQuery(query: Query) {
      await expect
        .poll(() =>
          requests.some(
            (item) => key(item) === key({ page: '1', ...query, limit: '10' }),
          ),
        )
        .toBe(true);
    },
    async expectEnd(width: number) {
      expect(unexpected).toEqual([]);
      expect(documents).toHaveLength(1);
      expect(
        requests.some(
          ({ free, club_id }) => free === 'true' && club_id !== undefined,
        ),
      ).toBe(false);
      for (const query of requests)
        expect(Object.values(query)).not.toContain('');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      await expect(page.getByRole('main')).toHaveJSProperty('scrollLeft', 0);
    },
  };
}
type Api = Awaited<ReturnType<typeof mockApi>>;

async function expectView(
  page: Page,
  snapshot: View,
  counts = snapshot.counts,
  hideFree = false,
) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(
    snapshot.response.data.length + 1,
  );
  for (const [index, player] of snapshot.response.data.entries()) {
    await expect(
      table
        .getByRole('row')
        .nth(index + 1)
        .getByRole('cell')
        .first(),
    ).toContainText(player.name);
  }
  await expect(page.getByRole('tab', { name: /^Todos/ })).toHaveText(
    `Todos ${counts[0]}`,
  );
  await expect(page.getByRole('tab', { name: /^Livres/ })).toHaveText(
    hideFree ? 'Livres' : new RegExp(`^Livres\\s*${counts[1]}$`),
  );
  await expect(page.getByRole('tab', { name: /^Em clubes/ })).toHaveText(
    `Em clubes ${counts[2]}`,
  );
}

async function choose(page: Page, label: string, option: string) {
  const trigger = page.getByRole('combobox', { name: label, exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeInViewport({ ratio: 1 });
  await trigger.click();
  const item = page.getByRole('option', { name: option, exact: true });
  await item.scrollIntoViewIfNeeded();
  await expect(item).toBeInViewport({ ratio: 1 });
  await item.click();
}

async function range(page: Page, label: string, min: string, max: string) {
  await page
    .getByRole('button', { name: `Filtrar por ${label}`, exact: true })
    .click();
  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: `Faixa de ${label}` });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await dialog.getByRole('textbox', { name: 'Mínimo', exact: true }).fill(min);
  await dialog.getByRole('textbox', { name: 'Máximo', exact: true }).fill(max);
  await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

const combinedQuery: Query = {
  search: 'meia',
  position: 'MEI',
  condition: 'MAL_CONDICIONADO',
  min_age: '18',
  max_age: '30',
  min_value: '10',
  max_value: '60',
  club_id: '1',
  sort: 'value_desc',
};

async function combine(page: Page, api: Api) {
  let filters: Query = { search: 'meia' };
  api.plan(filters, pair, filters);
  await page.getByRole('textbox', { name: 'Buscar por nome' }).fill('meia');
  await api.expectQuery(filters);
  await expectView(page, pair);
  for (const [field, code, label, option] of [
    ['position', 'MEI', 'Posição', 'Meio-campo'],
    ['condition', 'MAL_CONDICIONADO', 'Condição', 'Mal condicionado'],
  ]) {
    filters = { ...filters, [field]: code };
    api.plan(filters, pair, filters);
    await choose(page, label, option);
    await api.expectQuery(filters);
    await expectView(page, pair);
  }
  filters = { ...filters, min_age: '18', max_age: '30' };
  api.plan(filters, pair, filters);
  await range(page, 'idade', '18', '30');
  await api.expectQuery(filters);
  filters = { ...filters, min_value: '10', max_value: '60' };
  api.plan(filters, pair, filters);
  await range(page, 'valor de mercado', '10,00', '60,00');
  await api.expectQuery(filters);
  filters = { ...filters, club_id: '1' };
  api.plan(filters, linked);
  await choose(page, 'Clube', 'Águias FC');
  await api.expectQuery(filters);
  api.plan(combinedQuery, linked);
  await choose(page, 'Ordenar jogadores', 'maior valor de mercado');
  await api.expectQuery(combinedQuery);
  await expectView(page, linked, [1, 0, 1], true);
}

async function start(page: Page, initial = baseline) {
  const api = await mockApi(page);
  api.plan({}, initial, {});
  await page.goto('/jogadores');
  await expectView(page, initial);
  return api;
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test.describe(`F01/F02 player list interactions at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('combines search, filters and sorting, including valid free-player filters', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      await combine(page, api);
      await expect(
        page.getByRole('button', { name: /^Remover filtro / }),
      ).toHaveCount(6);
      await api.expectEnd(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('j02-combined.png'),
        fullPage: true,
      });
      const withoutClub = { ...combinedQuery };
      delete withoutClub.club_id;
      api.plan(withoutClub, pair);
      await page
        .getByRole('button', {
          name: 'Remover filtro Clube: Águias FC',
          exact: true,
        })
        .click();
      await api.expectQuery(withoutClub);
      await expectView(page, pair);
      const freeQuery = { ...withoutClub, free: 'true' };
      api.plan(freeQuery, free);
      await page.getByRole('tab', { name: /^Livres/ }).click();
      await api.expectQuery(freeQuery);
      await expectView(page, free, [2, 1, 1]);
      await expect(page.getByRole('tab', { name: /^Livres/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await api.expectEnd(viewport.width);
    });

    test('clears all controls and removes each chip while preserving other criteria', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      await combine(page, api);
      await page
        .getByRole('button', { name: 'Limpar filtros', exact: true })
        .click();
      await expectView(page, baseline);
      await expect(
        page.getByRole('textbox', { name: 'Buscar por nome' }),
      ).toHaveValue('');
      for (const label of ['Posição', 'Condição', 'Clube'])
        await expect(
          page.getByRole('combobox', { name: label, exact: true }),
        ).toHaveText(label);
      for (const label of ['idade', 'valor de mercado'])
        await expect(
          page.getByRole('button', {
            name: `Filtrar por ${label}`,
            exact: true,
          }),
        ).toHaveText(label === 'idade' ? 'Idade' : 'Valor de mercado');
      await expect(
        page.getByRole('combobox', { name: 'Ordenar jogadores' }),
      ).toHaveText('Ordenar: nome');
      await expect(
        page.getByRole('button', { name: /^Remover filtro / }),
      ).toHaveCount(0);
      await combine(page, api);
      const remaining = { ...combinedQuery };
      const removals = [
        {
          label: 'Idade: 18 a 30',
          fields: ['min_age', 'max_age'],
          result: linked,
        },
        {
          label: 'Valor de mercado: 10,00 a 60,00',
          fields: ['min_value', 'max_value'],
          result: linked,
        },
        { label: 'Clube: Águias FC', fields: ['club_id'], result: pair },
        { label: 'Posição: Meio-campo', fields: ['position'], result: pair },
        {
          label: 'Condição: Mal condicionado',
          fields: ['condition'],
          result: pair,
        },
        {
          label: 'Busca: meia',
          fields: ['search'],
          result: view([bruno, carla, ana, davi], [4, 2, 2]),
        },
      ];
      for (const [index, item] of removals.entries()) {
        for (const field of item.fields) delete remaining[field];
        const counters = { ...remaining };
        delete counters.club_id;
        delete counters.sort;
        api.plan(remaining, item.result);
        api.plan(
          counters,
          item.result === linked ? pair : item.result,
          counters,
        );
        const remove = page.getByRole('button', {
          name: `Remover filtro ${item.label}`,
          exact: true,
        });
        await remove.scrollIntoViewIfNeeded();
        await expect(remove).toBeInViewport({ ratio: 1 });
        await remove.click();
        await api.expectQuery(remaining);
        await expectView(
          page,
          item.result,
          item.result.counts,
          remaining.club_id !== undefined,
        );
        await expect(
          page.getByRole('button', { name: /^Remover filtro / }),
        ).toHaveCount(5 - index);
        await expect(
          page.getByRole('combobox', { name: 'Ordenar jogadores' }),
        ).toHaveText('Ordenar: maior valor de mercado');
      }
      await expect(
        page.getByRole('textbox', { name: 'Buscar por nome' }),
      ).toHaveValue('');
      await api.expectEnd(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('chips-cleared.png'),
        fullPage: true,
      });
    });

    test('uses all six sort options and preserves the order returned by the API', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      for (const item of sortCases) {
        const query: Query = item.code === undefined ? {} : { sort: item.code };
        const result = view(item.rows, [4, 2, 2]);
        api.plan(query, result);
        await choose(page, 'Ordenar jogadores', item.label);
        await api.expectQuery(query);
        await expectView(page, result);
        await expect(
          page.getByRole('combobox', { name: 'Ordenar jogadores' }),
        ).toHaveText(`Ordenar: ${item.label}`);
        await api.expectEnd(viewport.width);
      }
      expect(api.mainRequests()).toEqual([
        { page: '1', limit: '10' },
        ...sortCases
          .slice(0, 5)
          .map(({ code }) => ({ page: '1', limit: '10', sort: code })),
        { page: '1', limit: '10' },
      ]);
      await page.screenshot({
        path: testInfo.outputPath('sorting.png'),
        fullPage: true,
      });
    });

    test('preserves criteria between pages and resets page after filter, search and sort changes', async ({
      page,
    }, testInfo) => {
      const names = [
        'Alberto Meia',
        'Bruno Meia',
        'Caio Meia',
        'Daniel Meia',
        'Eduardo Meia',
        'Fabio Meia',
        'Gabriel Meia',
        'Heitor Meia',
        'Igor Meia',
        'Joao Meia',
        'Kevin Meia',
        'Lucas Meia',
      ];
      const roster = names.map((name, index) => ({
        ...carla,
        id: 101 + index,
        name,
        age: 24,
        market_value: 25.5,
      }));
      const first = view(roster.slice(0, 10), [12, 12, 0], 1, 12, 2);
      const second = view(roster.slice(10), [12, 12, 0], 2, 12, 2);
      const api = await start(page, first);
      let current: Query = {};
      async function next() {
        api.plan({ ...current, page: '2' }, second);
        const button = page.getByRole('button', {
          name: 'Próxima',
          exact: true,
        });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport({ ratio: 1 });
        await button.click();
        await api.expectQuery({ ...current, page: '2' });
        await expectView(page, second);
        await expect(
          page.getByText('Mostrando 11–12 de 12 jogadores', { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Página 2', exact: true }),
        ).toHaveAttribute('aria-current', 'page');
        await expect(button).toBeDisabled();
      }
      await next();
      for (const change of ['filter', 'search', 'sort']) {
        current =
          change === 'filter'
            ? { condition: 'MAL_CONDICIONADO' }
            : change === 'search'
              ? { ...current, search: 'Meia' }
              : { ...current, sort: 'value_desc' };
        const counterFilters = {
          condition: 'MAL_CONDICIONADO',
          ...(change === 'filter' ? {} : { search: 'Meia' }),
        };
        api.plan(current, first, counterFilters);
        if (change === 'filter')
          await choose(page, 'Condição', 'Mal condicionado');
        else if (change === 'search')
          await page
            .getByRole('textbox', { name: 'Buscar por nome' })
            .fill('Meia');
        else await choose(page, 'Ordenar jogadores', 'maior valor de mercado');
        await api.expectQuery(current);
        await expectView(page, first);
        await expect(
          page.getByText('Mostrando 1–10 de 12 jogadores', { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Página 1', exact: true }),
        ).toHaveAttribute('aria-current', 'page');
        await expect(
          page.getByRole('button', { name: 'Anterior', exact: true }),
        ).toBeDisabled();
        await next();
      }
      expect(api.mainRequests()).toEqual([
        { page: '1', limit: '10' },
        { page: '2', limit: '10' },
        { page: '1', limit: '10', condition: 'MAL_CONDICIONADO' },
        { page: '2', limit: '10', condition: 'MAL_CONDICIONADO' },
        {
          page: '1',
          limit: '10',
          condition: 'MAL_CONDICIONADO',
          search: 'Meia',
        },
        {
          page: '2',
          limit: '10',
          condition: 'MAL_CONDICIONADO',
          search: 'Meia',
        },
        {
          page: '1',
          limit: '10',
          condition: 'MAL_CONDICIONADO',
          search: 'Meia',
          sort: 'value_desc',
        },
        {
          page: '2',
          limit: '10',
          condition: 'MAL_CONDICIONADO',
          search: 'Meia',
          sort: 'value_desc',
        },
      ]);
      await api.expectEnd(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('filtered-page-two.png'),
        fullPage: true,
      });
    });

    test('recovers from no matches by removing a criterion or clearing all filters', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const empty = view([], [0, 0, 0], 1, 0, 0);
      api.plan({ search: 'zzz' }, empty, { search: 'zzz' });
      api.plan({ search: 'zzz', condition: 'MAL_CONDICIONADO' }, empty, {
        search: 'zzz',
        condition: 'MAL_CONDICIONADO',
      });
      api.plan({ condition: 'MAL_CONDICIONADO' }, pair, {
        condition: 'MAL_CONDICIONADO',
      });
      const input = page.getByRole('textbox', { name: 'Buscar por nome' });
      const table = page.getByRole('table', { name: 'Jogadores', exact: true });
      const list = page.getByRole('region', { name: 'Lista de jogadores' });
      await input.fill('zzz');
      await api.expectQuery({ search: 'zzz' });
      await choose(page, 'Condição', 'Mal condicionado');
      await api.expectQuery({ search: 'zzz', condition: 'MAL_CONDICIONADO' });
      await expect(
        page.getByText('Nenhum jogador encontrado para “zzz”', { exact: true }),
      ).toBeVisible();
      await expect(table).toHaveCount(0);
      await expect(
        page.getByRole('navigation', { name: 'Paginação de jogadores' }),
      ).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Novo jogador', exact: true }),
      ).toBeEnabled();
      await api.expectEnd(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('e02-filtered-empty.png'),
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Remover filtro Busca: zzz', exact: true })
        .click();
      await api.expectQuery({ condition: 'MAL_CONDICIONADO' });
      await expectView(page, pair);
      await expect(input).toHaveValue('');
      await expect(
        page.getByRole('button', {
          name: 'Remover filtro Condição: Mal condicionado',
          exact: true,
        }),
      ).toBeVisible();
      await input.fill('zzz');
      await expect(
        list.getByRole('button', { name: 'Limpar filtros', exact: true }),
      ).toBeVisible();
      await list
        .getByRole('button', { name: 'Limpar filtros', exact: true })
        .click();
      await expectView(page, baseline);
      await expect(input).toHaveValue('');
      await expect(
        page.getByRole('button', { name: /^Remover filtro / }),
      ).toHaveCount(0);
      await api.expectEnd(viewport.width);
    });

    for (const click of ['click', 'dblclick'] as const) {
      test(`refreshes players, counters and clubs once after ${click} without losing filters`, async ({
        page,
      }, testInfo) => {
        const api = await start(page);
        api.plan({ search: 'meia' }, pair, { search: 'meia' });
        await page
          .getByRole('textbox', { name: 'Buscar por nome' })
          .fill('meia');
        await api.expectQuery({ search: 'meia' });
        await expectView(page, pair);
        const updatedBruno = { ...bruno, agility: 70, market_value: 44.2 };
        const elisa = {
          ...bruno,
          id: 5,
          name: 'Elisa Meia',
          age: 26,
          base_value: 40,
          market_value: 34,
        };
        const updatedPair = view([updatedBruno, carla, elisa], [3, 1, 2]);
        api.plan(
          {},
          view([ana, updatedBruno, carla, davi, elisa], [5, 2, 3]),
          {},
        );
        api.plan({ search: 'meia' }, updatedPair, { search: 'meia' });
        api.setClubs([
          { id: 1, name: 'Águias Renovado', acronym: 'AGU' },
          { id: 2, name: 'Delta FC', acronym: 'DEL' },
        ]);
        const beforePlayers = api.requests.length;
        const beforeClubs = api.clubRequests();
        const release = api.hold();
        const refresh = page.getByRole('button', {
          name: 'Atualizar jogadores',
          exact: true,
        });
        try {
          await refresh[click]();
          await expect(refresh).toBeDisabled();
          await expect.poll(() => api.requests.length - beforePlayers).toBe(5);
          await expect.poll(() => api.clubRequests() - beforeClubs).toBe(1);
          release();
          await expectView(page, updatedPair);
          await expect(refresh).toBeEnabled();
          const row = page
            .getByRole('table', { name: 'Jogadores', exact: true })
            .getByRole('row')
            .filter({ hasText: 'Bruno Meia' });
          await expect(row.getByRole('cell').nth(3)).toHaveText('70');
          await expect(row.getByRole('cell').nth(7)).toHaveText('44,20');
          await expect(row.getByRole('cell').nth(8)).toContainText(
            'Águias Renovado',
          );
          await expect(
            page.getByRole('button', {
              name: 'Remover filtro Busca: meia',
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole('textbox', { name: 'Buscar por nome' }),
          ).toHaveValue('meia');
          expect(api.requests.slice(beforePlayers)).toEqual(
            expect.arrayContaining([
              { page: '1', limit: '10' },
              { page: '1', limit: '10', search: 'meia' },
              { page: '1', limit: '1', search: 'meia' },
              { page: '1', limit: '1', search: 'meia', free: 'true' },
              { page: '1', limit: '1', search: 'meia', free: 'false' },
            ]),
          );
          expect(api.requests).toHaveLength(beforePlayers + 5);
          expect(api.clubRequests()).toBe(beforeClubs + 1);
          await api.expectEnd(viewport.width);
          await page.screenshot({
            path: testInfo.outputPath('refreshed-list.png'),
            fullPage: true,
          });
        } finally {
          await testInfo.attach('refresh-requests.json', {
            body: JSON.stringify(
              {
                players: api.requests.slice(beforePlayers),
                clubs: api.clubRequests() - beforeClubs,
              },
              null,
              2,
            ),
            contentType: 'application/json',
          });
          release();
        }
      });
    }
  });
}
