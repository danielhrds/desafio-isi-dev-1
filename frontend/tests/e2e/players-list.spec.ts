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

test('J01 stays within a 375px viewport and opens the mobile sidebar', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/jogadores');

  await expect(page.getByRole('heading', { name: 'Jogadores' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Jogadores' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: testInfo.outputPath('j01-mobile.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Alternar menu' }).click();
  await expect(page.getByRole('link', { name: 'Jogadores' })).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath('j01-mobile-menu.png'),
    fullPage: true,
  });
});
