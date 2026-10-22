import { expect, test, type Locator, type Page } from '@playwright/test';
import type { PlayerDetail, PlayerListItem } from '../../src/types/player';

const free: PlayerDetail = {
  id: 7,
  name: 'Ênio Carvalho',
  position: 'LAT',
  age: 18,
  agility: 83,
  condition: 'DOENTE',
  club_id: null,
  overall: 69,
  base_value: 33.88,
  market_value: 32.19,
  pace: 66,
  shooting: 62,
  passing: 74,
  dribbling: 70,
  defending: 48,
  physical: 58,
  potential: 82,
};
const assigned: PlayerDetail = {
  id: 8,
  name: 'Danilo Freitas',
  position: 'ZAG',
  age: 30,
  agility: 25,
  condition: 'MAL_CONDICIONADO',
  club_id: 1,
  overall: 73,
  base_value: 36,
  market_value: 27,
  pace: 51,
  shooting: 32,
  passing: 63,
  dribbling: 54,
  defending: 86,
  physical: 79,
  potential: 77,
};
// A listagem é anterior à consulta individual, para detectar uso da fonte errada.
const listed: PlayerListItem[] = [
  { ...assigned, age: 29, agility: 24, overall: 72, market_value: 26.5 },
  { ...free, age: 17, agility: 80, overall: 68, market_value: 31.75 },
];
const freeFields = {
  'Valor base': '33,88',
  'Valor de mercado': '32,19',
  Overall: '69',
  Posição: 'Lateral',
  Idade: '18',
  Agilidade: '83',
  Condição: 'Doente',
  Clube: 'Livre',
  Velocidade: '66',
  Finalização: '62',
  Passe: '74',
  Drible: '70',
  Defesa: '48',
  Físico: '58',
  Potencial: '82',
};
const assignedFields = {
  'Valor base': '36,00',
  'Valor de mercado': '27,00',
  Overall: '73',
  Posição: 'Zagueiro',
  Idade: '30',
  Agilidade: '25',
  Condição: 'Mal condicionado',
  Clube: 'DEL · Delta FC',
  Velocidade: '51',
  Finalização: '32',
  Passe: '63',
  Drible: '54',
  Defesa: '86',
  Físico: '79',
  Potencial: '77',
};
interface Reply {
  data?: PlayerDetail;
  failure?: '404' | 'network';
  gate?: Promise<void>;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function mockApi(page: Page) {
  const replies = new Map<number, Reply>([
    [7, { data: free }],
    [8, { data: assigned }],
  ]);
  const details: number[] = [];
  const reads: string[] = [];
  const documents: string[] = [];
  const unexpected: string[] = [];
  const missingMessage = 'O jogador solicitado não existe ou foi excluído.';
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = /^\/api\/v1\/players\/(7|8)$/.exec(url.pathname);
    if (request.method() === 'GET' && id && !url.search) {
      expect(request.postData()).toBeNull();
      expect(request.headers().accept).toContain('application/json');
      const playerId = Number(id[1]);
      details.push(playerId);
      const reply = replies.get(playerId)!;
      if (reply.gate) await reply.gate;
      if (reply.failure === 'network') await route.abort('failed');
      else if (reply.failure === '404')
        await route.fulfill({ status: 404, json: { message: missingMessage } });
      else await route.fulfill({ json: reply.data });
      return;
    }
    if (
      request.method() === 'GET' &&
      url.pathname === '/api/v1/clubs' &&
      !url.search
    ) {
      reads.push('clubs');
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
      (query.free === undefined ||
        (query.limit === '1' && ['true', 'false'].includes(query.free))) &&
      Object.keys(query).every((key) =>
        ['page', 'limit', 'free'].includes(key),
      );
    if (!allowed) {
      unexpected.push(`${request.method()} ${request.url()}`);
      await route.fulfill({
        status: 400,
        json: { message: 'Pedido inesperado.' },
      });
      return;
    }
    reads.push(url.search);
    const result =
      query.free === 'true'
        ? { data: [listed[1]], total: 1 }
        : query.free === 'false'
          ? { data: [listed[0]], total: 1 }
          : { data: listed, total: 2 };
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
  return { replies, details, reads, documents, unexpected, missingMessage };
}

async function expectLayout(page: Page, width: number, dialog?: Locator) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await expect(
    page.getByRole('main', { includeHidden: true }),
  ).toHaveJSProperty('scrollLeft', 0);
  if (dialog) {
    await expect(dialog).toBeInViewport({ ratio: 1 });
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }
}

async function expectList(page: Page) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').nth(1)).toContainText(assigned.name);
  await expect(table.getByRole('row').nth(2)).toContainText(free.name);
  await expect(table.getByRole('row').nth(1)).toContainText('26,50');
  await expect(table.getByRole('row').nth(2)).toContainText('31,75');
  for (const [index, label] of ['Todos', 'Livres', 'Em clubes'].entries())
    await expect(
      page.getByRole('tab', { name: new RegExp(`^${label}`) }),
    ).toHaveText(new RegExp(`^${label}\\s*${[2, 1, 1][index]}$`));
}

async function start(page: Page) {
  const api = await mockApi(page);
  await page.goto('/jogadores');
  await expectList(page);
  await expect.poll(() => api.reads.length).toBe(5);
  expect(api.details).toEqual([]);
  return api;
}

async function openDetails(page: Page, player: PlayerDetail, width: number) {
  const actions = page.getByRole('button', {
    name: `Abrir ações de ${player.name}`,
    exact: true,
  });
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport({ ratio: 1 });
  await expectLayout(page, width);
  if (width === 375) {
    const container = page.locator('[data-slot="table-container"]');
    expect(
      await container.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await container.evaluate((element) => element.scrollLeft),
    ).toBeGreaterThan(0);
  }
  await actions.click();
  const item = page.getByRole('menuitem', {
    name: 'Ver detalhes',
    exact: true,
  });
  await expect(item).toBeInViewport({ ratio: 1 });
  await item.click();
  const dialog = page.getByRole('dialog', {
    name: 'Detalhes do jogador',
    exact: true,
  });
  await expectLayout(page, width, dialog);
  await expect(
    dialog.getByText(
      `${player.name} · ${player.position === 'LAT' ? 'Lateral' : 'Zagueiro'}`,
      { exact: true },
    ),
  ).toBeVisible();
  return dialog;
}

async function expectFields(dialog: Locator, fields: Record<string, string>) {
  await expect(dialog.locator('dt')).toHaveCount(15);
  for (const [label, value] of Object.entries(fields)) {
    const term = dialog
      .locator('dt')
      .filter({ hasText: new RegExp(`^${label}$`) });
    const description = term.locator('..').locator('dd');
    await description.scrollIntoViewIfNeeded();
    await expect(description).toBeInViewport({ ratio: 1 });
    await expect(description).toHaveText(value);
  }
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
}

async function closeDetails(dialog: Locator) {
  const close = dialog
    .locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Fechar', exact: true });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport({ ratio: 1 });
  await expect(close).toBeEnabled();
  await close.click();
  await expect(dialog).toHaveCount(0);
}

async function expectEnd(
  page: Page,
  api: Awaited<ReturnType<typeof start>>,
  width: number,
  reads: string[],
) {
  await expectList(page);
  expect(api.reads).toEqual(reads);
  expect(api.unexpected).toEqual([]);
  expect(api.documents).toHaveLength(1);
  await expect(page).toHaveURL(/\/jogadores$/);
  await expectLayout(page, width);
}

for (const width of [1366, 375]) {
  test.describe(`Detalhes J08 em ${width} px`, () => {
    test.use({ viewport: { width, height: width === 375 ? 812 : 768 } });

    test('consulta cada ID, mostra todos os dados da API e mantém o contexto ao fechar e trocar de jogador', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const reads = [...api.reads];
      const updated = gate();
      try {
        let dialog = await openDetails(page, free, width);
        await expectFields(dialog, freeFields);
        expect(api.details).toEqual([7]);
        await dialog.evaluate((element) => {
          element.scrollTop = 0;
        });
        await page.screenshot({
          path: testInfo.outputPath('details-free.png'),
          fullPage: true,
        });
        await closeDetails(dialog);
        await expectList(page);

        dialog = await openDetails(page, assigned, width);
        await expectFields(dialog, assignedFields);
        expect(api.details).toEqual([7, 8]);
        await dialog.evaluate((element) => {
          element.scrollTop = 0;
        });
        await page.screenshot({
          path: testInfo.outputPath('details-assigned.png'),
          fullPage: true,
        });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);

        api.replies.set(7, {
          data: { ...free, market_value: 34.73, condition: 'MAL_CONDICIONADO' },
          gate: updated.promise,
        });
        dialog = await openDetails(page, free, width);
        await expect.poll(() => api.details).toEqual([7, 8, 7]);
        // O cache exibido durante a atualização pertence ao ID reaberto.
        await expectFields(dialog, freeFields);
        await expect(
          dialog.getByText('DEL · Delta FC', { exact: true }),
        ).toHaveCount(0);
        updated.release();
        await expectFields(dialog, {
          ...freeFields,
          'Valor de mercado': '34,73',
          Condição: 'Mal condicionado',
        });
        await closeDetails(dialog);
        await expectEnd(page, api, width, reads);
      } finally {
        updated.release();
      }
    });

    for (const failure of ['404', 'network'] as const) {
      test(`carregamento, erro ${failure}, recuperação e fechamento pendente sem misturar jogadores`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(60_000);
        const api = await start(page);
        const reads = [...api.reads];
        const initial = gate();
        const recovery = gate();
        const late = gate();
        api.replies.set(7, { failure, gate: initial.promise });
        try {
          let dialog = await openDetails(page, free, width);
          const loading = dialog.getByRole('status');
          await expect(loading).toHaveText('Carregando detalhes...');
          await expect(dialog.locator('dl')).toHaveCount(0);
          await expect(dialog.getByRole('alert')).toHaveCount(0);
          expect(api.details).toEqual([7]);
          await page.screenshot({
            path: testInfo.outputPath('details-loading.png'),
            fullPage: true,
          });
          initial.release();

          // QueryClient mantém a política real: uma consulta + três retries.
          const alert = dialog.getByRole('alert');
          await expect(alert).toBeVisible({ timeout: 20_000 });
          await expect(
            alert.getByText('Não foi possível carregar os detalhes', {
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            alert.locator('[data-slot="alert-description"]'),
          ).toHaveText(
            failure === '404'
              ? api.missingMessage
              : 'Tente novamente em instantes.',
          );
          await expect(loading).toHaveCount(0);
          await expect(dialog.locator('dl')).toHaveCount(0);
          expect(api.details).toEqual([7, 7, 7, 7]);
          expect(api.reads).toEqual(reads);
          await page.screenshot({
            path: testInfo.outputPath('details-error.png'),
            fullPage: true,
          });

          api.replies.set(7, { data: free, gate: recovery.promise });
          const retry = alert.getByRole('button', {
            name: 'Tentar novamente',
            exact: true,
          });
          await retry.scrollIntoViewIfNeeded();
          await expect(retry).toBeInViewport({ ratio: 1 });
          await expect
            .poll(
              () =>
                retry.evaluate(
                  (element) => element.scrollWidth <= element.clientWidth,
                ),
              {
                message:
                  'O texto de Tentar novamente deve caber na área clicável.',
              },
            )
            .toBe(true);
          await retry.click();
          await expect(loading).toHaveText('Carregando detalhes...');
          await expect(alert).toHaveCount(0);
          await expect.poll(() => api.details.length).toBe(5);
          recovery.release();
          await expectFields(dialog, freeFields);
          await closeDetails(dialog);

          // Fechar uma leitura pendente é permitido. Sua resposta tardia não
          // pode substituir o jogador aberto em seguida nem reabrir o diálogo.
          api.replies.set(8, { data: assigned, gate: late.promise });
          dialog = await openDetails(page, assigned, width);
          await expect(dialog.getByRole('status')).toHaveText(
            'Carregando detalhes...',
          );
          await expect(dialog.locator('dl')).toHaveCount(0);
          expect(api.details).toEqual([7, 7, 7, 7, 7, 8]);
          await closeDetails(dialog);
          await expectList(page);
          api.replies.set(7, { data: free });
          dialog = await openDetails(page, free, width);
          await expectFields(dialog, freeFields);
          const completed = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/v1/players/8',
          );
          late.release();
          await completed;
          await expect.poll(() => api.details.length).toBe(7);
          await expectFields(dialog, freeFields);
          await expect(
            dialog.getByText(`${assigned.name} · Zagueiro`, { exact: true }),
          ).toHaveCount(0);
          await closeDetails(dialog);
          expect(api.details).toEqual([7, 7, 7, 7, 7, 8, 7]);
          await expectEnd(page, api, width, reads);
        } finally {
          initial.release();
          recovery.release();
          late.release();
        }
      });
    }
  });
}
