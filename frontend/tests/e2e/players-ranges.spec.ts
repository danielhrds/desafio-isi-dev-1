import { expect, test, type Page } from '@playwright/test';
import type { PlayerListItem } from '../../src/types/player';

const players: PlayerListItem[] = [
  {
    id: 1,
    name: 'André Lacerda',
    position: 'GOL',
    overall: 74,
    agility: 72,
    age: 16,
    condition: 'APTO',
    base_value: 10,
    market_value: 1,
    club_id: null,
  },
  {
    id: 2,
    name: 'Bruno Tavares',
    position: 'ZAG',
    overall: 74,
    agility: 72,
    age: 24,
    condition: 'APTO',
    base_value: 80,
    market_value: 10.5,
    club_id: 1,
  },
  {
    id: 3,
    name: 'Carlos Freitas',
    position: 'MEI',
    overall: 74,
    agility: 72,
    age: 30,
    condition: 'APTO',
    base_value: 70,
    market_value: 60,
    club_id: null,
  },
  {
    id: 4,
    name: 'Davi Melo',
    position: 'ATA',
    overall: 74,
    agility: 72,
    age: 45,
    condition: 'APTO',
    base_value: 400,
    market_value: 550,
    club_id: 1,
  },
];
const [andre, bruno, carlos, davi] = players;

interface RangeCase {
  min: string;
  max: string;
  params: Record<string, string>;
  rows: PlayerListItem[];
  counts: [number, number, number];
  summary: string;
  chip: string;
  reopened: [string, string];
}

interface RangeScenario {
  kind: string;
  label: string;
  defaultSummary: string;
  chipPrefix: string;
  invalid: string[];
  message: string;
  inverted: [string, string];
  cases: RangeCase[];
}

// Each expected response is fixed; the mock never filters or calculates values.
const scenarios: RangeScenario[] = [
  {
    kind: 'age',
    label: 'idade',
    defaultSummary: 'Idade',
    chipPrefix: 'Idade:',
    invalid: ['15', '46', '16.5', '16,5', '-1', 'abc'],
    message: 'Informe um valor entre 16 e 45.',
    inverted: ['30', '18'],
    cases: [
      {
        min: '16',
        max: '45',
        params: { min_age: '16', max_age: '45' },
        rows: players,
        counts: [4, 2, 2],
        summary: 'Idade: 16 a 45',
        chip: 'Idade: 16 a 45',
        reopened: ['16', '45'],
      },
      {
        min: '16',
        max: '16',
        params: { min_age: '16', max_age: '16' },
        rows: [andre],
        counts: [1, 1, 0],
        summary: 'Idade: 16 a 16',
        chip: 'Idade: 16 a 16',
        reopened: ['16', '16'],
      },
      {
        min: '45',
        max: '45',
        params: { min_age: '45', max_age: '45' },
        rows: [davi],
        counts: [1, 0, 1],
        summary: 'Idade: 45 a 45',
        chip: 'Idade: 45 a 45',
        reopened: ['45', '45'],
      },
      {
        min: '18',
        max: '30',
        params: { min_age: '18', max_age: '30' },
        rows: [bruno, carlos],
        counts: [2, 1, 1],
        summary: 'Idade: 18 a 30',
        chip: 'Idade: 18 a 30',
        reopened: ['18', '30'],
      },
      {
        min: '25',
        max: '',
        params: { min_age: '25' },
        rows: [carlos, davi],
        counts: [2, 1, 1],
        summary: 'Idade: 25 a 45',
        chip: 'Idade: 25 a 45',
        reopened: ['25', ''],
      },
      {
        min: '',
        max: '25',
        params: { max_age: '25' },
        rows: [andre, bruno],
        counts: [2, 1, 1],
        summary: 'Idade: 16 a 25',
        chip: 'Idade: 16 a 25',
        reopened: ['', '25'],
      },
    ],
  },
  {
    kind: 'value',
    label: 'valor de mercado',
    defaultSummary: 'Valor de mercado',
    chipPrefix: 'Valor de mercado:',
    invalid: ['-0.01', '550.01', '1.001', '1,001', 'abc'],
    message: 'Informe um valor entre 0 e 550.',
    inverted: ['60', '10,50'],
    cases: [
      {
        min: '0',
        max: '550',
        params: { min_value: '0', max_value: '550' },
        rows: players,
        counts: [4, 2, 2],
        summary: 'Valor: 0,00 a 550,00',
        chip: 'Valor de mercado: 0,00 a 550,00',
        reopened: ['0', '550'],
      },
      {
        min: '0',
        max: '0',
        params: { min_value: '0', max_value: '0' },
        rows: [],
        counts: [0, 0, 0],
        summary: 'Valor: 0,00 a 0,00',
        chip: 'Valor de mercado: 0,00 a 0,00',
        reopened: ['0', '0'],
      },
      {
        min: '1',
        max: '1',
        params: { min_value: '1', max_value: '1' },
        rows: [andre],
        counts: [1, 1, 0],
        summary: 'Valor: 1,00 a 1,00',
        chip: 'Valor de mercado: 1,00 a 1,00',
        reopened: ['1', '1'],
      },
      {
        min: '550',
        max: '550',
        params: { min_value: '550', max_value: '550' },
        rows: [davi],
        counts: [1, 0, 1],
        summary: 'Valor: 550,00 a 550,00',
        chip: 'Valor de mercado: 550,00 a 550,00',
        reopened: ['550', '550'],
      },
      {
        min: '10,50',
        max: '60,00',
        params: { min_value: '10.5', max_value: '60' },
        rows: [bruno, carlos],
        counts: [2, 1, 1],
        summary: 'Valor: 10,50 a 60,00',
        chip: 'Valor de mercado: 10,50 a 60,00',
        reopened: ['10,5', '60'],
      },
      {
        min: '10.50',
        max: '60.00',
        params: { min_value: '10.5', max_value: '60' },
        rows: [bruno, carlos],
        counts: [2, 1, 1],
        summary: 'Valor: 10,50 a 60,00',
        chip: 'Valor de mercado: 10,50 a 60,00',
        reopened: ['10,5', '60'],
      },
      {
        min: '10,50',
        max: '',
        params: { min_value: '10.5' },
        rows: [bruno, carlos, davi],
        counts: [3, 1, 2],
        summary: 'Valor: 10,50 a 550,00',
        chip: 'Valor de mercado: 10,50 a 550,00',
        reopened: ['10,5', ''],
      },
      {
        min: '',
        max: '10.50',
        params: { max_value: '10.5' },
        rows: [andre, bruno],
        counts: [2, 1, 1],
        summary: 'Valor: 0,00 a 10,50',
        chip: 'Valor de mercado: 0,00 a 10,50',
        reopened: ['', '10,5'],
      },
    ],
  },
];

function rangeKey(params: Record<string, string>) {
  return JSON.stringify([
    params.min_age,
    params.max_age,
    params.min_value,
    params.max_value,
  ]);
}

async function mockListings(page: Page, cases: RangeCase[]) {
  const requests: Record<string, string>[] = [];
  const unexpected: string[] = [];
  const navigations: string[] = [];
  const responses = new Map(cases.map((item) => [rangeKey(item.params), item]));
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      navigations.push(request.url());
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
    const noRange = rangeKey(params) === rangeKey({});
    const response = noRange
      ? { rows: players, counts: [4, 2, 2] }
      : responses.get(rangeKey(params));
    if (
      !response ||
      params.page !== '1' ||
      !['1', '10'].includes(params.limit)
    ) {
      unexpected.push(request.url());
      await route.fulfill({
        status: 400,
        json: { message: 'Consulta não prevista neste cenário.' },
      });
      return;
    }
    const isCounter = params.limit === '1';
    const total =
      response.counts[
        isCounter && params.free === 'true'
          ? 1
          : isCounter && params.free === 'false'
            ? 2
            : 0
      ];
    const sample =
      params.free === 'true'
        ? response.rows.find(({ club_id }) => club_id === null)
        : params.free === 'false'
          ? response.rows.find(({ club_id }) => club_id !== null)
          : response.rows[0];
    await route.fulfill({
      json: {
        data: isCounter ? (sample ? [sample] : []) : response.rows,
        meta: {
          page: 1,
          limit: isCounter ? 1 : 10,
          total_items: total,
          total_pages: isCounter ? total : total === 0 ? 0 : 1,
        },
      },
    });
  });
  return {
    requests,
    async expectLayout(width: number) {
      expect(unexpected).toEqual([]);
      expect(navigations).toHaveLength(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
      await expect(page.getByRole('main')).toHaveJSProperty('scrollLeft', 0);
    },
  };
}

const marketLabels: Record<number, string> = {
  1: '1,00',
  2: '10,50',
  3: '60,00',
  4: '550,00',
};

async function expectListing(
  page: Page,
  rows: PlayerListItem[],
  counts: number[],
) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  if (rows.length === 0) {
    await expect(
      page.getByText('Nenhum jogador encontrado', { exact: true }),
    ).toBeVisible();
    await expect(table).toHaveCount(0);
  } else {
    await expect(table).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(rows.length + 1);
    for (const [index, player] of rows.entries()) {
      const cells = table
        .getByRole('row')
        .nth(index + 1)
        .getByRole('cell');
      await expect(cells.first()).toContainText(player.name);
      await expect(cells.nth(4)).toHaveText(String(player.age));
      await expect(cells.nth(7)).toHaveText(marketLabels[player.id]);
    }
    await expect(
      page.getByText(
        `Mostrando 1–${rows.length} de ${counts[0]} ${counts[0] === 1 ? 'jogador' : 'jogadores'}`,
        { exact: true },
      ),
    ).toBeVisible();
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
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  for (const scenario of scenarios) {
    test(`F02 ${scenario.kind} range validates bounds and sends API parameters at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await page.setViewportSize(viewport);
      const api = await mockListings(page, scenario.cases);
      await page.goto('/jogadores');
      await expectListing(page, players, [4, 2, 2]);
      const trigger = page.getByRole('button', {
        name: `Filtrar por ${scenario.label}`,
        exact: true,
      });
      const dialog = page
        .getByRole('dialog')
        .filter({ hasText: `Faixa de ${scenario.label}` });
      const min = dialog.getByRole('textbox', { name: 'Mínimo', exact: true });
      const max = dialog.getByRole('textbox', { name: 'Máximo', exact: true });
      const apply = dialog.getByRole('button', {
        name: 'Aplicar',
        exact: true,
      });
      const clear = dialog.getByRole('button', { name: 'Limpar', exact: true });
      const chips = page.getByRole('button', {
        name: new RegExp(`^Remover filtro ${scenario.chipPrefix}`),
      });

      async function open() {
        await trigger.scrollIntoViewIfNeeded();
        await expect(trigger).toBeInViewport({ ratio: 1 });
        await trigger.click();
        await expect(dialog).toBeInViewport({ ratio: 1 });
        for (const field of [min, max, apply, clear])
          await expect(field).toBeInViewport({ ratio: 1 });
        await expect(min).toBeEditable();
        await expect(max).toBeEditable();
        await api.expectLayout(viewport.width);
      }

      await open();
      const initialRequests = api.requests.length;
      for (const field of ['min', 'max'] as const) {
        for (const invalid of scenario.invalid) {
          await min.fill(field === 'min' ? invalid : '');
          await max.fill(field === 'max' ? invalid : '');
          await apply.click();
          await expect(dialog.getByRole('alert')).toHaveText(scenario.message);
          await expect(field === 'min' ? min : max).toHaveAttribute(
            'aria-invalid',
            'true',
          );
          await expect(field === 'min' ? max : min).toHaveAttribute(
            'aria-invalid',
            'false',
          );
          await expect(dialog.getByRole('alert')).toBeInViewport({ ratio: 1 });
          expect(api.requests).toHaveLength(initialRequests);
        }
      }
      await min.fill(scenario.inverted[0]);
      await max.fill(scenario.inverted[1]);
      await apply.click();
      await expect(dialog.getByRole('alert')).toHaveText(
        'O máximo deve ser maior ou igual ao mínimo.',
      );
      await expect(max).toHaveAttribute('aria-invalid', 'true');
      expect(api.requests).toHaveLength(initialRequests);
      await expectListing(page, players, [4, 2, 2]);
      await api.expectLayout(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('range-invalid.png'),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await open();
      await expect(min).toHaveValue('');
      await expect(max).toHaveValue('');
      await expect(dialog.getByRole('alert')).toHaveCount(0);

      for (const item of scenario.cases) {
        await min.fill(item.min);
        await max.fill(item.max);
        await apply.click();
        await expect(dialog).not.toBeVisible();
        await expectListing(page, item.rows, item.counts);
        await expect(trigger).toHaveText(item.summary);
        await expect(chips).toHaveCount(1);
        await expect(
          page.getByRole('button', {
            name: `Remover filtro ${item.chip}`,
            exact: true,
          }),
        ).toBeVisible();
        expect(api.requests).toContainEqual({
          ...item.params,
          page: '1',
          limit: '10',
        });
        for (const free of [undefined, 'true', 'false']) {
          expect(api.requests).toContainEqual({
            ...item.params,
            page: '1',
            limit: '1',
            ...(free === undefined ? {} : { free }),
          });
        }
        await open();
        await expect(min).toHaveValue(item.reopened[0]);
        await expect(max).toHaveValue(item.reopened[1]);
        await expect(min).toHaveAttribute('aria-invalid', 'false');
        await expect(max).toHaveAttribute('aria-invalid', 'false');
        await expect(dialog.getByRole('alert')).toHaveCount(0);
      }
      await page.screenshot({
        path: testInfo.outputPath('range-applied.png'),
        fullPage: true,
      });
      await clear.click();
      await expect(dialog).not.toBeVisible();
      await expectListing(page, players, [4, 2, 2]);
      await expect(trigger).toHaveText(scenario.defaultSummary);
      await expect(chips).toHaveCount(0);
      await open();
      await expect(min).toHaveValue('');
      await expect(max).toHaveValue('');
      await apply.click();
      await expect(dialog).not.toBeVisible();
      await expectListing(page, players, [4, 2, 2]);
      await expect(chips).toHaveCount(0);
      await api.expectLayout(viewport.width);
      for (const request of api.requests) {
        expect(Object.values(request)).not.toContain('');
        expect(request.page).toBe('1');
        for (const [key, value] of Object.entries(request)) {
          if (key.startsWith('min_') || key.startsWith('max_'))
            expect(value).not.toContain(',');
        }
      }
    });
  }
}
