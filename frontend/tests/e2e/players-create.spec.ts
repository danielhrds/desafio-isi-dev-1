import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  CreatePlayerInput,
  PlayerDetail,
  PlayerListItem,
} from '../../src/types/player';

const input: CreatePlayerInput = {
  name: 'Davi Melo',
  position: 'MEI',
  age: 23,
  agility: 70,
  pace: 66,
  shooting: 62,
  passing: 74,
  dribbling: 70,
  defending: 48,
  physical: 58,
  potential: 82,
};
const created: PlayerDetail = {
  ...input,
  id: 2,
  condition: 'APTO',
  club_id: null,
  overall: 68,
  base_value: 26.4,
  market_value: 37.15,
};
const existing: PlayerListItem = {
  id: 1,
  name: 'Ana Costa',
  position: 'GOL',
  age: 24,
  agility: 60,
  condition: 'APTO',
  club_id: 1,
  overall: 71,
  base_value: 35,
  market_value: 35,
};
const numericFields = [
  ['age', 'Idade'],
  ['agility', 'Agilidade'],
  ['pace', 'Velocidade'],
  ['shooting', 'Finalização'],
  ['passing', 'Passe'],
  ['dribbling', 'Drible'],
  ['defending', 'Defesa'],
  ['physical', 'Físico'],
  ['potential', 'Potencial'],
] as const;
type NumericField = (typeof numericFields)[number][0];
const positionLabels = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
};
interface Reply {
  status: number;
  json: PlayerDetail | { message: string };
  postGate?: Promise<void>;
  refreshGate?: Promise<void>;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function mockApi(page: Page) {
  const posts: Array<{ body: unknown; contentType: string | undefined }> = [];
  const reads: Array<Record<string, string>> = [];
  const unexpected: string[] = [];
  const documents: string[] = [];
  const replies: Reply[] = [];
  let saved: PlayerDetail | undefined;
  let refreshGate: Promise<void> | undefined;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/api/v1/players') {
      posts.push({
        body: request.postDataJSON(),
        contentType: request.headers()['content-type'],
      });
      const reply = replies.shift();
      if (!reply) {
        unexpected.push('POST sem resposta planejada');
        await route.fulfill({
          status: 500,
          json: { message: 'POST inesperado.' },
        });
        return;
      }
      if (reply.postGate) await reply.postGate;
      if (reply.status === 201 && 'id' in reply.json) {
        saved = reply.json;
        refreshGate = reply.refreshGate;
      }
      await route.fulfill({
        status: reply.status,
        headers: reply.status === 201 ? { Location: '/api/v1/players/2' } : {},
        json: reply.json,
      });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      await route.fulfill({
        json: [{ id: 1, name: 'Águias FC', acronym: 'AGU' }],
      });
      return;
    }
    const query = Object.fromEntries(url.searchParams);
    const allowed =
      request.method() === 'GET' &&
      url.pathname === '/api/v1/players' &&
      query.page === '1' &&
      ['1', '10'].includes(query.limit) &&
      (query.search === undefined || query.search === 'Ana') &&
      (query.free === undefined ||
        (query.limit === '1' && ['true', 'false'].includes(query.free))) &&
      Object.keys(query).every((key) =>
        ['page', 'limit', 'search', 'free'].includes(key),
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
    const updated = saved;
    if (refreshGate) await refreshGate;
    // Respostas declaradas para cada consulta; sem filtrar ou calcular domínio.
    const snapshot =
      query.search === 'Ana' || !updated
        ? {
            all: { data: [existing], total: 1 },
            free: { data: [], total: 0 },
            assigned: { data: [existing], total: 1 },
          }
        : {
            all: { data: [existing, updated], total: 2 },
            free: { data: [updated], total: 1 },
            assigned: { data: [existing], total: 1 },
          };
    const result =
      query.free === 'true'
        ? snapshot.free
        : query.free === 'false'
          ? snapshot.assigned
          : snapshot.all;
    await route.fulfill({
      json: {
        data: query.limit === '1' ? result.data.slice(0, 1) : result.data,
        meta: {
          page: 1,
          limit: Number(query.limit),
          total_items: result.total,
          total_pages: query.limit === '1' ? result.total : 1,
        },
      },
    });
  });
  return {
    posts,
    reads,
    reply: (value: Reply) => replies.push(value),
    expectPosts(expected: CreatePlayerInput[]) {
      expect(posts.map(({ body }) => body)).toEqual(expected);
      for (const post of posts)
        expect(post.contentType).toContain('application/json');
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

function field(dialog: Locator, key: 'name' | NumericField) {
  return dialog.locator(`#create-${key}`);
}

async function fill(dialog: Locator, values: Partial<CreatePlayerInput>) {
  if (values.name !== undefined) await field(dialog, 'name').fill(values.name);
  if (values.position !== undefined) {
    await dialog
      .getByRole('button', {
        name: `${values.position} ${positionLabels[values.position]}`,
        exact: true,
      })
      .click();
  }
  for (const [key] of numericFields) {
    if (values[key] !== undefined)
      await field(dialog, key).fill(String(values[key]));
  }
}

async function expectValues(dialog: Locator, values: CreatePlayerInput) {
  await expect(field(dialog, 'name')).toHaveValue(values.name);
  for (const [key] of numericFields)
    await expect(field(dialog, key)).toHaveValue(String(values[key]));
  await expect(
    dialog.getByRole('button', {
      name: `${values.position} ${positionLabels[values.position]}`,
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
}

async function openCreate(page: Page, width: number) {
  await page.getByRole('button', { name: 'Novo jogador', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Novo jogador',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  for (const [code, label] of Object.entries(positionLabels))
    await expect(
      dialog.getByRole('button', { name: `${code} ${label}`, exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  for (const name of ['Cancelar', 'Salvar jogador'])
    await expect(
      dialog.getByRole('button', { name, exact: true }),
    ).toBeInViewport({ ratio: 1 });
  const body = dialog.locator('form > div').first();
  const size = await body.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.width);
  await expectLayout(page, width);
  return dialog;
}

async function start(page: Page) {
  const api = await mockApi(page);
  await page.goto('/jogadores');
  await expect(
    page
      .getByRole('table', { name: 'Jogadores', exact: true })
      .getByRole('row'),
  ).toHaveCount(2);
  await expectCounts(page, [1, 0, 1]);
  return api;
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

async function expectFieldError(
  dialog: Locator,
  key: 'name' | NumericField,
  message: string,
) {
  const control = field(dialog, key);
  const error = dialog.locator(`#create-${key}-error`);
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  await expect(control).toHaveAttribute(
    'aria-describedby',
    `create-${key}-error`,
  );
  await expect(error).toHaveText(message);
  await error.scrollIntoViewIfNeeded();
  await expect(error).toBeInViewport({ ratio: 1 });
  expect(
    await error.evaluate((element) =>
      element.parentElement?.contains(
        document.getElementById(element.id.replace('-error', '')),
      ),
    ),
  ).toBe(true);
}

async function expectSuccess(page: Page, player: PlayerDetail = created) {
  const dialog = page.getByRole('dialog', {
    name: 'Jogador cadastrado',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog).toContainText(`${player.name} entrou livre e Apto.`);
  const terms = dialog.locator('dl').first().locator(':scope > div');
  await expect(terms.nth(0).locator('dd')).toHaveText('26,40');
  await expect(terms.nth(1).locator('dd')).toHaveText('37,15');
  await expect(terms.nth(2).locator('dd')).toHaveText('68');
  return dialog;
}

function closeSuccess(dialog: Locator) {
  return dialog
    .locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Fechar', exact: true });
}

async function expectSavedList(page: Page, width: number) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table.getByRole('row')).toHaveCount(3);
  const row = table.getByRole('row').filter({ hasText: created.name });
  await expect(row.getByRole('cell').nth(0)).toContainText('Davi Melo');
  await expect(row.getByRole('cell').nth(1)).toHaveText('MEI');
  await expect(row.getByRole('cell').nth(2)).toHaveText('68');
  await expect(row.getByRole('cell').nth(3)).toHaveText('70');
  await expect(row.getByRole('cell').nth(4)).toHaveText('23');
  await expect(row.getByRole('cell').nth(5)).toHaveText('Apto');
  await expect(row.getByRole('cell').nth(6)).toHaveText('26,40');
  await expect(row.getByRole('cell').nth(7)).toHaveText('37,15');
  await expect(row.getByRole('cell').nth(8)).toContainText('Livre');
  await expectCounts(page, [2, 1, 1]);
  await expect(
    page.getByText('Mostrando 1–2 de 2 jogadores', { exact: true }),
  ).toBeVisible();
  const container = table.locator('..');
  if (width === 375) {
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

const boundaries: CreatePlayerInput[] = [
  {
    name: 'A B',
    position: 'GOL',
    age: 16,
    agility: 1,
    pace: 1,
    shooting: 1,
    passing: 1,
    dribbling: 1,
    defending: 1,
    physical: 1,
    potential: 1,
  },
  {
    name: `Á ${'a'.repeat(98)}`,
    position: 'ZAG',
    age: 45,
    agility: 85,
    pace: 80,
    shooting: 80,
    passing: 80,
    dribbling: 80,
    defending: 80,
    physical: 80,
    potential: 80,
  },
  {
    name: 'Lia Costa',
    position: 'LAT',
    age: 34,
    agility: 100,
    pace: 99,
    shooting: 1,
    passing: 1,
    dribbling: 1,
    defending: 1,
    physical: 1,
    potential: 99,
  },
  {
    name: 'Eva Souza',
    position: 'ATA',
    age: 32,
    agility: 100,
    pace: 1,
    shooting: 99,
    passing: 99,
    dribbling: 99,
    defending: 99,
    physical: 1,
    potential: 99,
  },
  {
    name: 'Ivo Alves',
    position: 'MEI',
    age: 33,
    agility: 85,
    pace: 1,
    shooting: 1,
    passing: 1,
    dribbling: 1,
    defending: 1,
    physical: 99,
    potential: 99,
  },
  {
    name: 'Bia Lima',
    position: 'MEI',
    age: 35,
    agility: 85,
    pace: 1,
    shooting: 1,
    passing: 99,
    dribbling: 99,
    defending: 99,
    physical: 99,
    potential: 99,
  },
];

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test.describe(`F04 player creation at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('validates every editable field inline without POST and accepts inclusive boundaries', async ({
      page,
    }, testInfo) => {
      test.setTimeout(180_000);
      const api = await start(page);
      let dialog = await openCreate(page, viewport.width);
      const save = () =>
        dialog.getByRole('button', { name: 'Salvar jogador', exact: true });
      await save().click();
      await expectFieldError(dialog, 'name', 'Use de 3 a 100 caracteres.');
      const positionGroup = dialog.getByRole('group', {
        name: 'Posição',
        exact: true,
      });
      const positionError = dialog.locator('#create-position-error');
      await expect(positionGroup).toHaveAttribute('aria-invalid', 'true');
      await expect(positionGroup).toHaveAttribute(
        'aria-describedby',
        'create-position-error',
      );
      await expect(positionError).toHaveText('Selecione uma posição.');
      await positionError.scrollIntoViewIfNeeded();
      await expect(positionError).toBeInViewport({ ratio: 1 });
      for (const [key] of numericFields) {
        await expectFieldError(
          dialog,
          key,
          key === 'age'
            ? 'Informe a idade.'
            : key === 'agility'
              ? 'Informe a agilidade.'
              : key === 'potential'
                ? 'Informe o potencial.'
                : 'Informe um valor de 1 a 99.',
        );
      }
      expect(api.posts).toHaveLength(0);
      await page.screenshot({
        path: testInfo.outputPath('j06-required.png'),
        fullPage: true,
      });
      await fill(dialog, { ...input, position: undefined });
      await save().click();
      await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(1);
      await expect(positionGroup).toHaveAttribute('aria-invalid', 'true');
      await expect(positionError).toHaveText('Selecione uma posição.');
      expect(api.posts).toHaveLength(0);
      await fill(dialog, input);
      await expect(positionGroup).toHaveAttribute('aria-invalid', 'false');
      await expect(positionError).toHaveCount(0);
      const invalidNames = [
        ['', 'Use de 3 a 100 caracteres.'],
        ['   ', 'Use de 3 a 100 caracteres.'],
        ['AB', 'Use de 3 a 100 caracteres.'],
        ['Ana', 'Use pelo menos duas palavras, sem números.'],
        ['Ana 2', 'Use pelo menos duas palavras, sem números.'],
        [`Á ${'a'.repeat(99)}`, 'Use de 3 a 100 caracteres.'],
        ['Ana \tCosta', 'Não use caracteres de controle.'],
      ];
      for (const [value, message] of invalidNames) {
        await test.step(`invalid name ${JSON.stringify(value)}`, async () => {
          await field(dialog, 'name').fill(value);
          await save().click();
          await expectFieldError(dialog, 'name', message);
          expect(api.posts).toHaveLength(0);
        });
      }
      await field(dialog, 'name').fill(input.name);
      for (const [key] of numericFields) {
        const min = key === 'age' ? 16 : 1;
        const max = key === 'age' ? 45 : key === 'agility' ? 100 : 99;
        for (const value of ['', String(min - 1), String(max + 1), '1.5']) {
          await test.step(`invalid ${key}=${JSON.stringify(value)}`, async () => {
            await field(dialog, key).fill(value);
            await save().click();
            const message =
              value === ''
                ? key === 'age'
                  ? 'Informe a idade.'
                  : key === 'agility'
                    ? 'Informe a agilidade.'
                    : key === 'potential'
                      ? 'Informe o potencial.'
                      : 'Informe um valor de 1 a 99.'
                : value === '1.5'
                  ? key === 'age'
                    ? 'Use uma idade inteira de 16 a 45 anos.'
                    : key === 'agility'
                      ? 'Use uma agilidade inteira de 1 a 100.'
                      : key === 'potential'
                        ? 'Use um potencial inteiro de 1 a 99.'
                        : 'Use um número inteiro de 1 a 99.'
                  : key === 'age'
                    ? 'Use uma idade de 16 a 45 anos.'
                    : key === 'agility'
                      ? 'Use uma agilidade de 1 a 100.'
                      : key === 'potential'
                        ? 'Use um potencial de 1 a 99.'
                        : 'Use um valor de 1 a 99.';
            await expectFieldError(dialog, key, message);
            expect(api.posts).toHaveLength(0);
          });
        }
        await field(dialog, key).fill(String(input[key]));
      }
      const combined: Array<{
        values: Partial<CreatePlayerInput>;
        key: NumericField;
        message: string;
      }> = [
        {
          values: { age: 35, agility: 86, potential: 74 },
          key: 'agility',
          message: 'Com 35 anos ou mais, use no máximo 85.',
        },
        {
          values: {
            pace: 81,
            shooting: 80,
            passing: 80,
            dribbling: 80,
            defending: 80,
            physical: 80,
            potential: 99,
          },
          key: 'physical',
          message: 'A soma dos seis atributos não pode passar de 480.',
        },
        {
          values: { potential: 73 },
          key: 'potential',
          message: 'O potencial deve ser pelo menos igual ao maior atributo.',
        },
        {
          values: { age: 33, potential: 75 },
          key: 'potential',
          message: 'Com 33 anos ou mais, iguale o potencial ao maior atributo.',
        },
      ];
      for (const { values, key, message } of combined) {
        await fill(dialog, { ...input, ...values });
        await save().click();
        await expectFieldError(dialog, key, message);
        expect(api.posts).toHaveLength(0);
      }
      await expectLayout(page, viewport.width);
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      for (const values of boundaries) {
        await test.step(`accepted limits with ${values.position}, age ${values.age}`, async () => {
          dialog = await openCreate(page, viewport.width);
          await fill(dialog, values);
          const response = { ...created, ...values };
          api.reply({ status: 201, json: response });
          await save().click();
          const success = await expectSuccess(page, response);
          await expectLayout(page, viewport.width);
          await closeSuccess(success).click();
        });
      }
      api.expectPosts(boundaries);
      await api.expectEnd(viewport.width);
    });

    test('posts the exact payload and displays returned data, refreshing list and counts without reload', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      await page.getByRole('textbox', { name: 'Buscar por nome' }).fill('Ana');
      await expect(
        page.getByRole('button', {
          name: 'Remover filtro Busca: Ana',
          exact: true,
        }),
      ).toBeVisible();
      const dialog = await openCreate(page, viewport.width);
      await fill(dialog, { ...input, name: '  Davi   Melo  ' });
      await expect(
        dialog.getByText('Após salvar', { exact: true }),
      ).toHaveCount(2);
      await expect(dialog.getByRole('textbox')).toHaveCount(1);
      await expect(dialog.getByRole('spinbutton')).toHaveCount(9);
      await page.screenshot({
        path: testInfo.outputPath('j05-filled.png'),
        fullPage: true,
      });
      const beforeReads = api.reads.length;
      api.reply({ status: 201, json: created });
      await dialog
        .getByRole('button', { name: 'Salvar jogador', exact: true })
        .click();
      const success = await expectSuccess(page);
      await expect(
        page.getByRole('dialog', { name: 'Novo jogador', exact: true }),
      ).toHaveCount(0);
      api.expectPosts([input]);
      for (const query of [
        { page: '1', limit: '10' },
        { page: '1', limit: '1' },
        { page: '1', limit: '1', free: 'true' },
        { page: '1', limit: '1', free: 'false' },
      ])
        expect(api.reads.slice(beforeReads)).toContainEqual(query);
      await success
        .getByRole('button', { name: 'Ver detalhes', exact: true })
        .click();
      const details = success.locator('div.rounded-lg.border.p-3');
      const values = [
        ['Posição', 'Meio-campo'],
        ['Idade', '23'],
        ['Agilidade', '70'],
        ['Velocidade', '66'],
        ['Finalização', '62'],
        ['Passe', '74'],
        ['Drible', '70'],
        ['Defesa', '48'],
        ['Físico', '58'],
        ['Potencial', '82'],
        ['Condição', 'Apto'],
        ['Clube', 'Livre'],
      ];
      for (const [label, value] of values) {
        const term = details
          .locator('dl > div')
          .filter({ has: page.getByText(label, { exact: true }) });
        await expect(term.locator('dd')).toHaveText(value);
      }
      await success
        .getByRole('button', { name: 'Ocultar detalhes', exact: true })
        .click();
      await expect(details).toHaveCount(0);
      await closeSuccess(success).scrollIntoViewIfNeeded();
      await expect(closeSuccess(success)).toBeInViewport({ ratio: 1 });
      await page.screenshot({
        path: testInfo.outputPath('j07-created.png'),
        fullPage: true,
      });
      await closeSuccess(success).click();
      await expectSavedList(page, viewport.width);
      await expect(
        page.getByRole('textbox', { name: 'Buscar por nome' }),
      ).toHaveValue('');
      await expect(
        page.getByRole('button', { name: /^Remover filtro / }),
      ).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath('created-list.png'),
        fullPage: true,
      });
      const reopened = await openCreate(page, viewport.width);
      await expect(field(reopened, 'name')).toHaveValue('');
      for (const [key] of numericFields)
        await expect(field(reopened, key)).toHaveValue('');
      await expect(reopened.locator('[aria-invalid="true"]')).toHaveCount(0);
      await reopened
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      api.expectPosts([input]);
      await api.expectEnd(viewport.width);
    });

    test('shows the exact API message, preserves all fields and allows retry after refusal', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const dialog = await openCreate(page, viewport.width);
      const values: CreatePlayerInput = { ...input, position: 'ATA' };
      await fill(dialog, values);
      const beforeReads = api.reads.length;
      const errors = [
        {
          status: 400,
          message: 'Cadastro recusado: indicador inválido no servidor.',
        },
        {
          status: 503,
          message: 'Serviço indisponível — tente novamente mais tarde.',
        },
      ];
      for (const { status, message } of errors) {
        api.reply({ status, json: { message } });
        await dialog
          .getByRole('button', { name: 'Salvar jogador', exact: true })
          .click();
        const alert = dialog.getByRole('alert');
        await expect(alert).toContainText('Não foi possível cadastrar');
        await expect(
          alert.locator('[data-slot="alert-description"]'),
        ).toHaveText(message);
        await alert.scrollIntoViewIfNeeded();
        await expect(alert).toBeInViewport({ ratio: 1 });
        await expectValues(dialog, values);
        await expect(
          dialog.getByRole('button', { name: 'Salvar jogador', exact: true }),
        ).toBeEnabled();
        await expect(
          dialog.getByRole('button', { name: 'Cancelar', exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByRole('dialog', { name: 'Jogador cadastrado', exact: true }),
        ).toHaveCount(0);
        expect(api.reads).toHaveLength(beforeReads);
        await expect(
          page.locator('table[aria-label="Jogadores"] tr'),
        ).toHaveCount(2);
        await expectCounts(page, [1, 0, 1]);
        await expectLayout(page, viewport.width);
      }
      api.expectPosts([values, values]);
      await dialog.getByRole('alert').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath('create-api-error.png'),
        fullPage: true,
      });
      const response = { ...created, position: 'ATA' as const };
      api.reply({ status: 201, json: response });
      await dialog
        .getByRole('button', { name: 'Salvar jogador', exact: true })
        .click();
      const success = await expectSuccess(page, response);
      await expect(
        page.getByText(errors[1].message, { exact: true }),
      ).toHaveCount(0);
      await closeSuccess(success).click();
      await expect(
        page
          .getByRole('table', { name: 'Jogadores', exact: true })
          .getByRole('row'),
      ).toHaveCount(3);
      await expectCounts(page, [2, 1, 1]);
      api.expectPosts([values, values, values]);
      await api.expectEnd(viewport.width);
    });

    test('disables submission and dismissal until refresh completes and sends one POST after double click', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const dialog = await openCreate(page, viewport.width);
      await fill(dialog, input);
      const post = gate();
      const refresh = gate();
      api.reply({
        status: 201,
        json: created,
        postGate: post.promise,
        refreshGate: refresh.promise,
      });
      const save = dialog.getByRole('button', {
        name: 'Salvar jogador',
        exact: true,
      });
      const cancel = dialog.getByRole('button', {
        name: 'Cancelar',
        exact: true,
      });
      const beforeReads = api.reads.length;
      try {
        await save.dblclick();
        await expect.poll(() => api.posts.length).toBe(1);
        await expect(save).toBeDisabled();
        await expect(cancel).toBeDisabled();
        await expect(
          dialog.getByRole('button', { name: 'Fechar', exact: true }),
        ).toHaveCount(0);
        await page.keyboard.press('Escape');
        await page.mouse.click(2, 2);
        await expect(dialog).toBeVisible();
        await expect(
          page.getByRole('dialog', { name: 'Jogador cadastrado', exact: true }),
        ).toHaveCount(0);
        api.expectPosts([input]);
        expect(api.reads).toHaveLength(beforeReads);
        await page.screenshot({
          path: testInfo.outputPath('create-pending.png'),
          fullPage: true,
        });
        post.release();
        await expect.poll(() => api.reads.length - beforeReads).toBe(4);
        await expect(save).toBeDisabled();
        await expect(cancel).toBeDisabled();
        await expect(
          page.getByRole('dialog', { name: 'Jogador cadastrado', exact: true }),
        ).toHaveCount(0);
        refresh.release();
        const success = await expectSuccess(page);
        await closeSuccess(success).click();
        await expectSavedList(page, viewport.width);
        api.expectPosts([input]);
        await api.expectEnd(viewport.width);
      } finally {
        post.release();
        refresh.release();
        await testInfo.attach('create-requests.json', {
          body: JSON.stringify({ posts: api.posts, reads: api.reads }, null, 2),
          contentType: 'application/json',
        });
      }
    });
  });
}
