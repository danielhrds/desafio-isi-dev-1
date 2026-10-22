import { expect, test, type Locator, type Page } from '@playwright/test';
import type {
  PlayerCondition,
  PlayerDetail,
  PlayerListItem,
} from '../../src/types/player';

const labels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
};
const healthy: PlayerDetail = {
  id: 7,
  name: 'Ênio Carvalho',
  position: 'LAT',
  age: 18,
  agility: 83,
  condition: 'APTO',
  club_id: null,
  overall: 69,
  base_value: 33.88,
  market_value: 37.27,
  pace: 66,
  shooting: 62,
  passing: 74,
  dribbling: 70,
  defending: 48,
  physical: 58,
  potential: 82,
};
const players: Record<PlayerCondition, PlayerDetail> = {
  APTO: healthy,
  MAL_CONDICIONADO: {
    ...healthy,
    condition: 'MAL_CONDICIONADO',
    market_value: 34.73,
  },
  DOENTE: { ...healthy, condition: 'DOENTE', market_value: 32.19 },
};
const prices: Record<PlayerCondition, string> = {
  APTO: '37,27',
  MAL_CONDICIONADO: '34,73',
  DOENTE: '32,19',
};
const assigned: PlayerListItem = {
  id: 8,
  name: 'Danilo Freitas',
  position: 'ZAG',
  age: 30,
  agility: 25,
  condition: 'APTO',
  club_id: 1,
  overall: 73,
  base_value: 36.5,
  market_value: 36.5,
};
interface Reply {
  status: number;
  json: PlayerDetail | { message: string };
  patchGate?: Promise<void>;
  refreshGate?: Promise<void>;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function mockApi(page: Page, initial: PlayerCondition) {
  const patches: Array<{ body: unknown; contentType: string | undefined }> = [];
  const reads: Array<Record<string, string>> = [];
  const replies: Reply[] = [];
  const unexpected: string[] = [];
  const documents: string[] = [];
  let current = players[initial];
  let clubs = 0;
  let details = 0;
  let refreshGate: Promise<void> | undefined;
  let detailGate: Promise<void> | undefined;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documents.push(request.url());
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.method() === 'PATCH' &&
      url.pathname === '/api/v1/players/7/condition'
    ) {
      patches.push({
        body: request.postDataJSON(),
        contentType: request.headers()['content-type'],
      });
      const reply = replies.shift();
      if (!reply) {
        unexpected.push('PATCH sem resposta planejada');
        await route.fulfill({
          status: 500,
          json: { message: 'PATCH inesperado.' },
        });
        return;
      }
      if (reply.patchGate) await reply.patchGate;
      if (reply.status === 200 && 'id' in reply.json) {
        current = reply.json;
        refreshGate = reply.refreshGate;
      }
      await route.fulfill({ status: reply.status, json: reply.json });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/players/7') {
      details += 1;
      const response = current;
      if (detailGate) await detailGate;
      await route.fulfill({ json: response });
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
      (query.condition === undefined || query.condition === 'APTO') &&
      (query.free === undefined ||
        (query.limit === '1' && ['true', 'false'].includes(query.free))) &&
      Object.keys(query).every((key) =>
        ['page', 'limit', 'condition', 'free'].includes(key),
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
    // As respostas do filtro são declaradas, sem reproduzir regras de domínio.
    const filtered = {
      APTO: {
        all: { data: [assigned, healthy], total: 2 },
        free: { data: [healthy], total: 1 },
      },
      MAL_CONDICIONADO: {
        all: { data: [assigned], total: 1 },
        free: { data: [], total: 0 },
      },
      DOENTE: {
        all: { data: [assigned], total: 1 },
        free: { data: [], total: 0 },
      },
    }[current.condition];
    const snapshot =
      query.condition === 'APTO'
        ? { ...filtered, assigned: { data: [assigned], total: 1 } }
        : {
            all: { data: [assigned, current], total: 2 },
            free: { data: [current], total: 1 },
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
          total_pages: query.limit === '1' ? result.total : 1,
        },
      },
    });
  });
  return {
    patches,
    reads,
    clubRequests: () => clubs,
    detailRequests: () => details,
    reply: (value: Reply) => replies.push(value),
    holdDetails() {
      const held = gate();
      detailGate = held.promise;
      return () => {
        detailGate = undefined;
        held.release();
      };
    },
    expectPatches(expected: PlayerCondition[]) {
      expect(patches.map(({ body }) => body)).toEqual(
        expected.map((condition) => ({ condition })),
      );
      for (const patch of patches)
        expect(patch.contentType).toContain('application/json');
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

async function start(page: Page, initial: PlayerCondition = 'APTO') {
  const api = await mockApi(page, initial);
  await page.goto('/jogadores');
  await expect(
    page
      .getByRole('table', { name: 'Jogadores', exact: true })
      .getByRole('row'),
  ).toHaveCount(3);
  await expectCounts(page, [2, 1, 1]);
  return api;
}

async function openAction(page: Page, action: string, width: number) {
  await page.mouse.move(0, 0);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, {
    timeout: 10_000,
  });
  const actions = page.getByRole('button', {
    name: 'Abrir ações de Ênio Carvalho',
    exact: true,
  });
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeInViewport({ ratio: 1 });
  await expectLayout(page, width);
  await actions.click();
  const item = page.getByRole('menuitem', { name: action, exact: true });
  await expect(item).toBeInViewport({ ratio: 1 });
  await item.click();
}

function radio(dialog: Locator, condition: PlayerCondition) {
  return dialog.locator(`#condition-${condition}`);
}

async function openCondition(
  page: Page,
  current: PlayerCondition,
  width: number,
) {
  await openAction(page, 'Alterar condição', width);
  const dialog = page.getByRole('dialog', {
    name: 'Alterar condição física',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByText(healthy.name, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('Lateral · 18 anos', { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator('[data-slot="badge"]').first()).toHaveText(
    labels[current],
  );
  const group = dialog.getByRole('radiogroup', {
    name: 'Condição física',
    exact: true,
  });
  await expect(group.getByRole('radio')).toHaveCount(3);
  await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);
  await expect(radio(dialog, current)).toBeChecked();
  for (const condition of Object.keys(labels) as PlayerCondition[]) {
    const control = radio(dialog, condition);
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 1 });
    await expect(control).toHaveAccessibleName(
      new RegExp(`^${labels[condition]}`),
    );
    if (current === 'DOENTE' && condition === 'APTO')
      await expect(control).toBeDisabled();
    else await expect(control).toBeEnabled();
  }
  await expect(
    dialog.getByRole('button', { name: 'Salvar condição', exact: true }),
  ).toBeEnabled();
  await expectLayout(page, width);
  return dialog;
}

async function choose(dialog: Locator, condition: PlayerCondition) {
  const control = radio(dialog, condition);
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport({ ratio: 1 });
  await control.check();
  await expect(control).toBeChecked();
}

async function expectSuccess(page: Page, condition: PlayerCondition) {
  await expect(
    page.getByRole('dialog', { name: 'Alterar condição física', exact: true }),
  ).toHaveCount(0);
  const toast = page.locator('[data-sonner-toast]');
  await expect(
    toast.getByText('Condição física atualizada', { exact: true }),
  ).toBeVisible();
  await expect(
    toast.getByText(
      `Ênio Carvalho agora está ${labels[condition].toLocaleLowerCase('pt-BR')}.`,
      { exact: true },
    ),
  ).toBeVisible();
}

async function expectList(
  page: Page,
  condition: PlayerCondition,
  width: number,
) {
  const table = page.getByRole('table', { name: 'Jogadores', exact: true });
  await expect(table.getByRole('row')).toHaveCount(3);
  const row = table.getByRole('row').filter({ hasText: healthy.name });
  const expected = [
    'Ênio Carvalho',
    'LAT',
    '69',
    '83',
    '18',
    labels[condition],
    '33,88',
    prices[condition],
    'Livre',
  ];
  for (const [index, text] of expected.entries()) {
    if (index === 0)
      await expect(row.getByRole('cell').nth(index)).toContainText(text);
    else await expect(row.getByRole('cell').nth(index)).toHaveText(text);
  }
  await expectCounts(page, [2, 1, 1]);
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

async function openDetails(page: Page, width: number) {
  await openAction(page, 'Ver detalhes', width);
  const dialog = page.getByRole('dialog', {
    name: 'Detalhes do jogador',
    exact: true,
  });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  return dialog;
}

async function expectDetails(dialog: Locator, condition: PlayerCondition) {
  for (const [label, value] of [
    ['Valor base', '33,88'],
    ['Valor de mercado', prices[condition]],
    ['Overall', '69'],
    ['Condição', labels[condition]],
  ]) {
    const term = dialog
      .locator('dl > div')
      .filter({ has: dialog.page().getByText(label, { exact: true }) });
    await expect(term.locator('dd')).toHaveText(value);
  }
}

async function closeDetails(dialog: Locator) {
  const close = dialog
    .locator('[data-slot="dialog-footer"]')
    .getByRole('button', { name: 'Fechar', exact: true });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 375, height: 812 },
]) {
  test.describe(`F04 player condition at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('sends all five allowed transitions and updates filtered results, list and cached details without reload', async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      const api = await start(page);
      const initialDetails = await openDetails(page, viewport.width);
      await expectDetails(initialDetails, 'APTO');
      await closeDetails(initialDetails);
      await page
        .getByRole('combobox', { name: 'Condição', exact: true })
        .click();
      await page.getByRole('option', { name: 'Apto', exact: true }).click();
      await expectCounts(page, [2, 1, 1]);
      const transitions: PlayerCondition[] = [
        'MAL_CONDICIONADO',
        'APTO',
        'DOENTE',
        'MAL_CONDICIONADO',
        'DOENTE',
      ];
      let current: PlayerCondition = 'APTO';
      const expected: PlayerCondition[] = [];
      for (const [index, next] of transitions.entries()) {
        await test.step(`${current} to ${next}`, async () => {
          const dialog = await openCondition(page, current, viewport.width);
          await choose(dialog, next);
          const beforeReads = api.reads.length;
          api.reply({ status: 200, json: players[next] });
          await dialog
            .getByRole('button', { name: 'Salvar condição', exact: true })
            .click();
          await expectSuccess(page, next);
          expected.push(next);
          api.expectPatches(expected);
          if (index === 0) {
            const table = page.getByRole('table', {
              name: 'Jogadores',
              exact: true,
            });
            await expect(table.getByRole('row')).toHaveCount(2);
            await expect(
              table.getByText(healthy.name, { exact: true }),
            ).toHaveCount(0);
            await expectCounts(page, [1, 0, 1]);
            await expect(
              page.getByRole('combobox', { name: 'Condição', exact: true }),
            ).toContainText('Apto');
            for (const query of [
              { page: '1', limit: '10', condition: 'APTO' },
              { page: '1', limit: '1', condition: 'APTO' },
              { page: '1', limit: '1', condition: 'APTO', free: 'true' },
              { page: '1', limit: '1', condition: 'APTO', free: 'false' },
            ])
              expect(api.reads.slice(beforeReads)).toContainEqual(query);
            await page.screenshot({
              path: testInfo.outputPath('j10-filter-updated.png'),
              fullPage: true,
            });
            await page
              .getByRole('button', {
                name: 'Remover filtro Condição: Apto',
                exact: true,
              })
              .click();
          }
          await expectList(page, next, viewport.width);
          const beforeDetails = api.detailRequests();
          const release = api.holdDetails();
          try {
            const details = await openDetails(page, viewport.width);
            await expect
              .poll(() => api.detailRequests())
              .toBe(beforeDetails + 1);
            await expectDetails(details, next);
            await expect(
              details.getByText('Carregando detalhes...', { exact: true }),
            ).toHaveCount(0);
            if (index === 0)
              await page.screenshot({
                path: testInfo.outputPath('j10-cached-details.png'),
                fullPage: true,
              });
            release();
            await closeDetails(details);
          } finally {
            release();
          }
          current = next;
        });
      }
      api.expectPatches(transitions);
      await expectList(page, 'DOENTE', viewport.width);
      await api.expectEnd(viewport.width);
    });

    test('preselects the current condition, blocks sick-to-fit, cancels changes and accepts an unchanged condition', async ({
      page,
    }, testInfo) => {
      const api = await start(page, 'DOENTE');
      let dialog = await openCondition(page, 'DOENTE', viewport.width);
      await expect(
        dialog.getByText('De Doente não passa direto para Apto.', {
          exact: true,
        }),
      ).toBeVisible();
      await radio(dialog, 'MAL_CONDICIONADO').focus();
      await page.keyboard.press('ArrowUp');
      await expect(radio(dialog, 'APTO')).not.toBeChecked();
      await expect(radio(dialog, 'APTO')).toBeDisabled();
      await choose(dialog, 'MAL_CONDICIONADO');
      await dialog.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: testInfo.outputPath('j10-sick-blocked.png'),
        fullPage: true,
      });
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      api.expectPatches([]);
      await expectList(page, 'DOENTE', viewport.width);
      dialog = await openCondition(page, 'DOENTE', viewport.width);
      await radio(dialog, 'DOENTE').click();
      await expect(radio(dialog, 'DOENTE')).toBeChecked();
      await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(1);
      api.reply({ status: 200, json: players.DOENTE });
      await dialog
        .getByRole('button', { name: 'Salvar condição', exact: true })
        .click();
      await expectSuccess(page, 'DOENTE');
      await expectList(page, 'DOENTE', viewport.width);
      api.expectPatches(['DOENTE']);
      dialog = await openCondition(page, 'DOENTE', viewport.width);
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await dialog
        .getByRole('button', { name: 'Cancelar', exact: true })
        .click();
      api.expectPatches(['DOENTE']);
      await api.expectEnd(viewport.width);
    });

    test('shows exact API refusals, preserves the selected condition and allows retry', async ({
      page,
    }, testInfo) => {
      const api = await start(page, 'MAL_CONDICIONADO');
      const errors: Array<{
        status: number;
        next: PlayerCondition;
        message: string;
      }> = [
        {
          status: 400,
          next: 'DOENTE',
          message: 'Condição recusada: confira os dados enviados.',
        },
        {
          status: 404,
          next: 'MAL_CONDICIONADO',
          message: 'Jogador não encontrado ou excluído.',
        },
        {
          status: 409,
          next: 'APTO',
          message: 'O jogador ficou doente; não pode passar direto para Apto.',
        },
      ];
      let current: PlayerCondition = 'MAL_CONDICIONADO';
      const expected: PlayerCondition[] = [];
      for (const { status, next, message } of errors) {
        const dialog = await openCondition(page, current, viewport.width);
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        await choose(dialog, next);
        const beforeReads = api.reads.length;
        const beforeClubs = api.clubRequests();
        api.reply({ status, json: { message } });
        await dialog
          .getByRole('button', { name: 'Salvar condição', exact: true })
          .click();
        const alert = dialog.getByRole('alert');
        await expect(
          alert.getByText('Não foi possível alterar a condição', {
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          alert.locator('[data-slot="alert-description"]'),
        ).toHaveText(message);
        await alert.scrollIntoViewIfNeeded();
        await expect(alert).toBeInViewport({ ratio: 1 });
        await expect(radio(dialog, next)).toBeChecked();
        await expect(
          dialog.getByRole('button', { name: 'Salvar condição', exact: true }),
        ).toBeEnabled();
        await expect(
          dialog.getByRole('button', { name: 'Cancelar', exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByText('Condição física atualizada', { exact: true }),
        ).toHaveCount(0);
        const oldRow = page
          .locator('table[aria-label="Jogadores"] tbody tr')
          .filter({ hasText: healthy.name });
        await expect(oldRow.locator('td').nth(5)).toHaveText(labels[current]);
        await expect(oldRow.locator('td').nth(7)).toHaveText(prices[current]);
        expect(api.reads).toHaveLength(beforeReads);
        expect(api.clubRequests()).toBe(beforeClubs);
        expected.push(next);
        api.expectPatches(expected);
        await expectLayout(page, viewport.width);
        await page.screenshot({
          path: testInfo.outputPath(`j10-error-${status}.png`),
          fullPage: true,
        });
        api.reply({ status: 200, json: players[next] });
        await dialog
          .getByRole('button', { name: 'Salvar condição', exact: true })
          .click();
        await expectSuccess(page, next);
        await expect(page.getByText(message, { exact: true })).toHaveCount(0);
        await expectList(page, next, viewport.width);
        expected.push(next);
        api.expectPatches(expected);
        current = next;
      }
      await api.expectEnd(viewport.width);
    });

    test('sends one PATCH after double click and blocks controls and dismissal until refresh finishes', async ({
      page,
    }, testInfo) => {
      const api = await start(page);
      const dialog = await openCondition(page, 'APTO', viewport.width);
      await choose(dialog, 'DOENTE');
      const patch = gate();
      const refresh = gate();
      api.reply({
        status: 200,
        json: players.DOENTE,
        patchGate: patch.promise,
        refreshGate: refresh.promise,
      });
      const save = dialog.locator('button[type="submit"]');
      const cancel = dialog.getByRole('button', {
        name: 'Cancelar',
        exact: true,
      });
      const beforeReads = api.reads.length;
      const beforeClubs = api.clubRequests();
      try {
        await save.dblclick();
        await expect.poll(() => api.patches.length).toBe(1);
        await expect(save).toBeDisabled();
        await expect(save).toHaveText('Salvando...');
        await expect(cancel).toBeDisabled();
        for (const condition of Object.keys(labels) as PlayerCondition[])
          await expect(radio(dialog, condition)).toBeDisabled();
        await page.keyboard.press('Escape');
        await page.mouse.click(2, 2);
        await dialog
          .getByRole('button', { name: 'Fechar', exact: true })
          .click();
        await expect(dialog).toBeVisible();
        await expect(
          page.getByText('Condição física atualizada', { exact: true }),
        ).toHaveCount(0);
        api.expectPatches(['DOENTE']);
        expect(api.reads).toHaveLength(beforeReads);
        expect(api.clubRequests()).toBe(beforeClubs);
        await save.scrollIntoViewIfNeeded();
        await expect(save).toBeInViewport({ ratio: 1 });
        await page.screenshot({
          path: testInfo.outputPath('j10-pending.png'),
          fullPage: true,
        });
        patch.release();
        await expect.poll(() => api.reads.length - beforeReads).toBe(4);
        await expect.poll(() => api.clubRequests() - beforeClubs).toBe(1);
        await expect(save).toBeDisabled();
        await expect(cancel).toBeDisabled();
        await expect(
          page.getByText('Condição física atualizada', { exact: true }),
        ).toHaveCount(0);
        refresh.release();
        await expectSuccess(page, 'DOENTE');
        await expectList(page, 'DOENTE', viewport.width);
        api.expectPatches(['DOENTE']);
        await api.expectEnd(viewport.width);
      } finally {
        patch.release();
        refresh.release();
        await testInfo.attach('condition-requests.json', {
          body: JSON.stringify(
            {
              patches: api.patches,
              reads: api.reads,
              clubs: api.clubRequests(),
            },
            null,
            2,
          ),
          contentType: 'application/json',
        });
      }
    });
  });
}
