import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  PlayerDetail,
  PlayerListItem,
  UpdatePlayerInput,
} from '../../src/types/player';

const free: PlayerDetail = {
  id: 7,
  name: 'Bruno Meia',
  position: 'MEI',
  age: 16,
  agility: 70,
  condition: 'MAL_CONDICIONADO',
  club_id: null,
  overall: 74,
  base_value: 52.2,
  market_value: 48.1,
  pace: 66,
  shooting: 62,
  passing: 74,
  dribbling: 70,
  defending: 48,
  physical: 58,
  potential: 82,
};
const assigned: PlayerListItem = {
  id: 8,
  name: 'Danilo Freitas',
  position: 'ZAG',
  age: 30,
  agility: 25,
  condition: 'MAL_CONDICIONADO',
  club_id: 1,
  overall: 73,
  base_value: 36.5,
  market_value: 27.37,
};
const input: UpdatePlayerInput = {
  name: 'Zeca Meia',
  position: 'ATA',
  age: 34,
  agility: 100,
};
const updated: PlayerDetail = {
  ...free,
  ...input,
  overall: 81,
  market_value: 19.35,
};
const positions = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
};
type Field = 'name' | 'age' | 'agility';
interface Reply {
  status: number;
  json: PlayerDetail | { message: string };
  putGate?: Promise<void>;
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
  const puts: Array<{ body: unknown; contentType: string | undefined }> = [];
  const reads: Array<Record<string, string>> = [];
  const replies: Reply[] = [];
  const unexpected: string[] = [];
  const documents: string[] = [];
  let saved: PlayerDetail | undefined;
  let refreshGate: Promise<void> | undefined;
  let clubs = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'PUT' && url.pathname === '/api/v1/players/7') {
      puts.push({
        body: request.postDataJSON(),
        contentType: request.headers()['content-type'],
      });
      const reply = replies.shift();
      if (!reply) {
        unexpected.push('PUT sem resposta planejada');
        await route.fulfill({
          status: 500,
          json: { message: 'PUT inesperado.' },
        });
        return;
      }
      if (reply.putGate) await reply.putGate;
      if (reply.status === 200 && 'id' in reply.json) {
        saved = reply.json;
        refreshGate = reply.refreshGate;
      }
      await route.fulfill({ status: reply.status, json: reply.json });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/clubs') {
      clubs += 1;
      if (refreshGate) await refreshGate;
      await route.fulfill({
        json: [{ id: 1, name: 'Delta FC', acronym: 'DEL' }],
      });
      return;
    }
    const query = Object.fromEntries(url.searchParams);
    const allowed =
      request.method() === 'GET' &&
      url.pathname === '/api/v1/players' &&
      query.page === '1' &&
      ['1', '10'].includes(query.limit) &&
      (query.position === undefined || query.position === 'MEI') &&
      (query.free === undefined ||
        (query.limit === '1' && ['true', 'false'].includes(query.free))) &&
      Object.keys(query).every((key) =>
        ['page', 'limit', 'position', 'free'].includes(key),
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
    // Cada estado tem respostas fixas; o mock não aplica filtros ou fórmulas.
    const snapshot =
      query.position === 'MEI'
        ? saved
          ? {
              all: { data: [], total: 0 },
              free: { data: [], total: 0 },
              assigned: { data: [], total: 0 },
            }
          : {
              all: { data: [free], total: 1 },
              free: { data: [free], total: 1 },
              assigned: { data: [], total: 0 },
            }
        : {
            all: {
              data: saved ? [assigned, saved] : [free, assigned],
              total: 2,
            },
            free: { data: [saved ?? free], total: 1 },
            assigned: { data: [assigned], total: 1 },
          };
    const result =
      query.free === 'true'
        ? snapshot.free
        : query.free === 'false'
          ? snapshot.assigned
          : snapshot.all;
    if (refreshGate) await refreshGate;
    await route.fulfill({
      json: {
        data: query.limit === '1' ? result.data.slice(0, 1) : result.data,
        meta: {
          page: 1,
          limit: Number(query.limit),
          total_items: result.total,
          total_pages:
            query.limit === '1' ? result.total : result.total === 0 ? 0 : 1,
        },
      },
    });
  });
  return {
    puts,
    reads,
    clubRequests: () => clubs,
    reply: (value: Reply) => replies.push(value),
    expectPuts(expected: UpdatePlayerInput[]) {
      expect(puts.map(({ body }) => body)).toEqual(expected);
      for (const put of puts)
        expect(put.contentType).toContain('application/json');
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

async function start(page: Page) {
  const api = await mockApi(page);
  await page.goto('/jogadores');
  await expect(
    page
      .getByRole('table', { name: 'Jogadores', exact: true })
      .getByRole('row'),
  ).toHaveCount(3);
  await expectCounts(page, [2, 1, 1]);
  return api;
}

function field(dialog: Locator, key: Field) {
  return dialog.locator(`#edit-${key}`);
}

function position(dialog: Locator, code: UpdatePlayerInput['position']) {
  return dialog.getByRole('button', {
    name: `${code} ${positions[code]}`,
    exact: true,
  });
}

async function fill(dialog: Locator, values: UpdatePlayerInput) {
  await field(dialog, 'name').fill(values.name);
  await position(dialog, values.position).click();
  await field(dialog, 'age').fill(String(values.age));
  await field(dialog, 'agility').fill(String(values.agility));
}

async function expectValues(dialog: Locator, values: UpdatePlayerInput) {
  await expect(field(dialog, 'name')).toHaveValue(values.name);
  await expect(field(dialog, 'age')).toHaveValue(String(values.age));
  await expect(field(dialog, 'agility')).toHaveValue(String(values.agility));
  await expect(position(dialog, values.position)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

async function openEdit(page: Page, player: PlayerListItem, width: number) {
  // O hover pausa o toast; aguarde sua saída antes de abrir ações sob ele.
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, {
    timeout: 10_000,
  });
  const row = page
    .getByRole('table', { name: 'Jogadores', exact: true })
    .getByRole('row')
    .filter({ hasText: player.name });
  const actions = row.getByRole('button', {
    name: `Abrir ações de ${player.name}`,
    exact: true,
  });
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport({ ratio: 1 });
  await expectLayout(page, width);
  await actions.click();
  const edit = page.getByRole('menuitem', { name: 'Editar', exact: true });
  await expect(edit).toBeInViewport({ ratio: 1 });
  await edit.click();
  const dialog = page.getByRole('dialog', {
    name: 'Editar jogador',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expectValues(dialog, player);
  await expect(dialog.getByRole('textbox')).toHaveCount(1);
  await expect(dialog.getByRole('spinbutton')).toHaveCount(2);
  for (const [key] of Object.entries(positions)) {
    const control = position(dialog, key as UpdatePlayerInput['position']);
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 1 });
  }
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeEnabled();
  await expectLayout(page, width);
  return dialog;
}

async function expectFieldError(dialog: Locator, key: Field, message: string) {
  const control = field(dialog, key);
  const error = dialog.locator(`#edit-${key}-error`);
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  await expect(control).toHaveAttribute(
    'aria-describedby',
    `edit-${key}-error`,
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

async function expectSuccess(page: Page, name: string) {
  await expect(
    page.getByRole('dialog', { name: 'Editar jogador', exact: true }),
  ).toHaveCount(0);
  const toast = page.locator('[data-sonner-toast]').filter({
    has: page.getByText(`${name} foi atualizado com sucesso.`, { exact: true }),
  });
  await expect(
    toast.getByText('Jogador atualizado', { exact: true }),
  ).toBeVisible();
}

async function expectSavedList(page: Page, width: number) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(
    table.getByRole('row').nth(1).getByRole('cell').first(),
  ).toContainText('Danilo Freitas');
  const row = table.getByRole('row').nth(2);
  const expected = [
    'Zeca Meia',
    'ATA',
    '81',
    '100',
    '34',
    'Mal condicionado',
    '52,20',
    '19,35',
    'Livre',
  ];
  for (const [index, value] of expected.entries()) {
    if (index === 0)
      await expect(row.getByRole('cell').nth(index)).toContainText(value);
    else await expect(row.getByRole('cell').nth(index)).toHaveText(value);
  }
  await expect(table.getByText('Bruno Meia', { exact: true })).toHaveCount(0);
  await expectCounts(page, [2, 1, 1]);
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

const invalid: Array<{ key: Field; value: string; message: string }> = [
  { key: 'name', value: '', message: 'Use de 3 a 100 caracteres.' },
  { key: 'name', value: '   ', message: 'Use de 3 a 100 caracteres.' },
  { key: 'name', value: 'AB', message: 'Use de 3 a 100 caracteres.' },
  {
    key: 'name',
    value: 'Ana',
    message: 'Use pelo menos duas palavras, sem números.',
  },
  {
    key: 'name',
    value: 'Ana 2',
    message: 'Use pelo menos duas palavras, sem números.',
  },
  {
    key: 'name',
    value: `Á ${'a'.repeat(99)}`,
    message: 'Use de 3 a 100 caracteres.',
  },
  {
    key: 'name',
    value: 'Ana \tCosta',
    message: 'Não use caracteres de controle.',
  },
  { key: 'age', value: '', message: 'Informe a idade.' },
  { key: 'age', value: '15', message: 'Use uma idade de 16 a 45 anos.' },
  { key: 'age', value: '46', message: 'Use uma idade de 16 a 45 anos.' },
  {
    key: 'age',
    value: '16.5',
    message: 'Use uma idade inteira de 16 a 45 anos.',
  },
  { key: 'agility', value: '', message: 'Informe a agilidade.' },
  { key: 'agility', value: '0', message: 'Use uma agilidade de 1 a 100.' },
  { key: 'agility', value: '101', message: 'Use uma agilidade de 1 a 100.' },
  {
    key: 'agility',
    value: '1.5',
    message: 'Use uma agilidade inteira de 1 a 100.',
  },
];
const boundaries: UpdatePlayerInput[] = [
  { name: 'Z Z', position: 'GOL', age: 16, agility: 1 },
  { name: `Z ${'a'.repeat(98)}`, position: 'ZAG', age: 16, agility: 100 },
  { name: 'Zelia Costa', position: 'LAT', age: 34, agility: 100 },
  { name: 'Zelia Melo', position: 'ATA', age: 35, agility: 85 },
  { name: 'Zelia Souza', position: 'MEI', age: 45, agility: 85 },
  {
    name: `${'𐐀'.repeat(49)} ${'𐐨'.repeat(50)}`,
    position: 'MEI',
    age: 45,
    agility: 85,
  },
];

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test.describe(`F04 player editing at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('prefills editable fields, validates limits, prevents known conflicts and discards canceled changes', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      const api = await start(page);
      let dialog = await openEdit(page, free, viewport.width);
      await expect(
        dialog.getByText(/Não mudam depois do cadastro/),
      ).toContainText('52,20');
      for (const code of Object.keys(
        positions,
      ) as UpdatePlayerInput['position'][]) {
        await expect(position(dialog, code)).toBeEnabled();
        await position(dialog, code).click();
        await expect(position(dialog, code)).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }
      for (const { key, value, message } of invalid) {
        await test.step(`invalid ${key}=${JSON.stringify(value)}`, async () => {
          await fill(dialog, free);
          await field(dialog, key).fill(value);
          await dialog
            .getByRole('button', { name: 'Salvar alterações', exact: true })
            .click();
          await expectFieldError(dialog, key, message);
          expect(api.puts).toHaveLength(0);
        });
      }
      await fill(dialog, { ...input, age: 35, agility: 86 });
      await dialog
        .getByRole('button', { name: 'Salvar alterações', exact: true })
        .click();
      await expectFieldError(
        dialog,
        'agility',
        'Com 35 anos ou mais, use no máximo 85.',
      );
      expect(api.puts).toHaveLength(0);
      await expectLayout(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('j09-invalid.png'),
        fullPage: true,
      });
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      dialog = await openEdit(page, free, viewport.width);
      await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(0);
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      dialog = await openEdit(page, assigned, viewport.width);
      for (const code of Object.keys(
        positions,
      ) as UpdatePlayerInput['position'][]) {
        if (code === 'ZAG') await expect(position(dialog, code)).toBeEnabled();
        else await expect(position(dialog, code)).toBeDisabled();
      }
      await expect(dialog.locator('#edit-position-help')).toHaveText(
        'Jogador com clube não muda de posição: as outras posições ficam desabilitadas.',
      );
      await dialog.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: testInfo.outputPath('j09-assigned.png'),
        fullPage: true,
      });
      await field(dialog, 'age').fill('29');
      await dialog
        .getByRole('button', { name: 'Salvar alterações', exact: true })
        .click();
      await expectFieldError(
        dialog,
        'age',
        'A idade não pode diminuir (atual: 30).',
      );
      expect(api.puts).toHaveLength(0);
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      dialog = await openEdit(page, assigned, viewport.width);
      await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(0);
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      let current = free;
      for (const values of boundaries) {
        dialog = await openEdit(page, current, viewport.width);
        await fill(dialog, values);
        const response = { ...updated, ...values };
        api.reply({ status: 200, json: response });
        await dialog
          .getByRole('button', { name: 'Salvar alterações', exact: true })
          .click();
        await expectSuccess(page, values.name);
        await expectLayout(page, viewport.width);
        current = response;
      }
      api.expectPuts(boundaries);
      await api.expectEnd(viewport.width);
    });

    test('sends only the four editable fields and refreshes API data and filtered results without reload', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      await page
        .getByRole('combobox', { name: 'Posição', exact: true })
        .click();
      await page
        .getByRole('option', { name: 'Meio-campo', exact: true })
        .click();
      await expectCounts(page, [1, 1, 0]);
      const dialog = await openEdit(page, free, viewport.width);
      await fill(dialog, { ...input, name: '  Zeca   Meia  ' });
      const beforeReads = api.reads.length;
      api.reply({ status: 200, json: updated });
      await dialog
        .getByRole('button', { name: 'Salvar alterações', exact: true })
        .click();
      await expectSuccess(page, input.name);
      api.expectPuts([input]);
      await expect(
        page.getByRole('table', { name: 'Jogadores', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText('Nenhum jogador encontrado', { exact: true }),
      ).toBeVisible();
      await expectCounts(page, [0, 0, 0]);
      await expect(
        page.getByRole('combobox', { name: 'Posição', exact: true }),
      ).toContainText('Meio-campo');
      for (const query of [
        { page: '1', limit: '10' },
        { page: '1', limit: '10', position: 'MEI' },
        { page: '1', limit: '1', position: 'MEI' },
        { page: '1', limit: '1', position: 'MEI', free: 'true' },
        { page: '1', limit: '1', position: 'MEI', free: 'false' },
      ])
        expect(api.reads.slice(beforeReads)).toContainEqual(query);
      await page.screenshot({
        path: testInfo.outputPath('j09-updated-filter.png'),
        fullPage: true,
      });
      await page
        .getByRole('button', {
          name: 'Remover filtro Posição: Meio-campo',
          exact: true,
        })
        .click();
      await expectSavedList(page, viewport.width);
      await page.screenshot({
        path: testInfo.outputPath('j09-updated-list.png'),
        fullPage: true,
      });
      const reopened = await openEdit(page, updated, viewport.width);
      await expect(
        reopened.getByText(/Não mudam depois do cadastro/),
      ).toContainText('52,20');
      await expect(reopened.locator('[aria-invalid="true"]')).toHaveCount(0);
      await reopened
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      api.expectPuts([input]);
      await api.expectEnd(viewport.width);
    });

    test('shows exact 400, 404 and 409 messages, preserves edits and recovers on retry', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const expected: UpdatePlayerInput[] = [];
      const errors = [
        {
          status: 400,
          name: 'Zeca Alves',
          message: 'Edição recusada: confira os dados enviados.',
        },
        {
          status: 404,
          name: 'Zeca Braga',
          message: 'Jogador não encontrado ou excluído.',
        },
        {
          status: 409,
          name: 'Zeca Costa',
          message: 'A idade mudou no servidor; ela não pode diminuir.',
        },
      ];
      let current = free;
      for (const { status, name, message } of errors) {
        const dialog = await openEdit(page, current, viewport.width);
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        const values = { ...input, name };
        await fill(dialog, values);
        const beforeReads = api.reads.length;
        const beforeClubs = api.clubRequests();
        api.reply({ status, json: { message } });
        await dialog
          .getByRole('button', { name: 'Salvar alterações', exact: true })
          .click();
        const alert = dialog.getByRole('alert');
        await expect(
          alert.getByText('Não foi possível salvar alterações', {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          alert.locator('[data-slot="alert-description"]'),
        ).toHaveText(message);
        await alert.scrollIntoViewIfNeeded();
        await expect(alert).toBeInViewport({ ratio: 1 });
        await expectValues(dialog, values);
        for (const action of ['Salvar alterações', 'Cancelar'])
          await expect(
            dialog.getByRole('button', { name: action, exact: true }),
          ).toBeEnabled();
        await expect(
          page.getByText(`${name} foi atualizado com sucesso.`, {
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          page.locator('table[aria-label="Jogadores"] tr'),
        ).toHaveCount(3);
        await expect(
          page.locator('table[aria-label="Jogadores"]'),
        ).toContainText(current.name);
        await expect(
          page.locator('table[aria-label="Jogadores"]'),
        ).not.toContainText(name);
        await expectCounts(page, [2, 1, 1]);
        expect(api.reads).toHaveLength(beforeReads);
        expect(api.clubRequests()).toBe(beforeClubs);
        expected.push(values);
        api.expectPuts(expected);
        await expectLayout(page, viewport.width);
        await alert.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath(`j09-error-${status}.png`),
          fullPage: true,
        });
        const response = { ...updated, name };
        api.reply({ status: 200, json: response });
        await dialog
          .getByRole('button', { name: 'Salvar alterações', exact: true })
          .click();
        await expectSuccess(page, name);
        await expect(page.getByText(message, { exact: true })).toHaveCount(0);
        await expect(
          page.getByRole('table', { name: 'Jogadores', exact: true }),
        ).toContainText(name);
        expected.push(values);
        api.expectPuts(expected);
        current = response;
      }
      await api.expectEnd(viewport.width);
    });

    test('sends one PUT after double click and blocks actions and dismissal until refresh finishes', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const dialog = await openEdit(page, free, viewport.width);
      await fill(dialog, input);
      const put = gate();
      const refresh = gate();
      api.reply({
        status: 200,
        json: updated,
        putGate: put.promise,
        refreshGate: refresh.promise,
      });
      const save = dialog.getByRole('button', {
        name: 'Salvar alterações',
        exact: true,
      });
      const cancel = dialog.getByRole('button', {
        name: 'Cancelar',
        exact: true,
      });
      const beforeReads = api.reads.length;
      const beforeClubs = api.clubRequests();
      try {
        await save.dblclick();
        await expect.poll(() => api.puts.length).toBe(1);
        await expect(save).toBeDisabled();
        await expect(cancel).toBeDisabled();
        for (const code of Object.keys(
          positions,
        ) as UpdatePlayerInput['position'][])
          await expect(position(dialog, code)).toBeDisabled();
        await expect(
          dialog.getByRole('button', { name: 'Fechar', exact: true }),
        ).toHaveCount(0);
        await page.keyboard.press('Escape');
        await page.mouse.click(2, 2);
        await expect(dialog).toBeVisible();
        await expect(
          page.getByText('Jogador atualizado', { exact: true }),
        ).toHaveCount(0);
        api.expectPuts([input]);
        expect(api.reads).toHaveLength(beforeReads);
        expect(api.clubRequests()).toBe(beforeClubs);
        await expectLayout(page, viewport.width);
        await page.screenshot({
          path: testInfo.outputPath('j09-pending.png'),
          fullPage: true,
        });
        put.release();
        await expect.poll(() => api.reads.length - beforeReads).toBe(4);
        await expect.poll(() => api.clubRequests() - beforeClubs).toBe(1);
        await expect(save).toBeDisabled();
        await expect(cancel).toBeDisabled();
        await expect(
          page.getByText('Jogador atualizado', { exact: true }),
        ).toHaveCount(0);
        refresh.release();
        await expectSuccess(page, input.name);
        await expectSavedList(page, viewport.width);
        api.expectPuts([input]);
        await api.expectEnd(viewport.width);
      } finally {
        put.release();
        refresh.release();
        await testInfo.attach('edit-requests.json', {
          body: JSON.stringify(
            { puts: api.puts, reads: api.reads, clubs: api.clubRequests() },
            null,
            2,
          ),
          contentType: 'application/json',
        });
      }
    });
  });
}
