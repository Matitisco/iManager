import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { bootstrapStoreViaApi, buildTestEmail, createStoreViaApi, loginViaUi } from './utils';

const SHOTS = process.env.INSTAGRAM_SHOTS?.trim();

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1270, value_sell: 1290 }, last_update: '2026-10-08T21:10:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1300,00', valor_cierre_ant: '1290,00' },
  }));
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function expectFits(page: Page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

test('asks only for a name and keeps optional currency folded on desktop and mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUi(page, buildTestEmail(testInfo, 'name-only'));
  await expect(page.getByTestId('onboarding-store-name')).toBeVisible();
  await expect(page.getByTestId('onboarding-instagram')).toHaveCount(0);
  await expect(page.locator('.onb-currency')).not.toHaveAttribute('open');
  await shot(page, 'onboarding-1440');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectFits(page);
  await shot(page, 'onboarding-390');
});

test('asks existing stores for instagram without blocking the app', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const email = buildTestEmail(testInfo, 'ig-settings');
  const legacy = `Sin IG ${testInfo.parallelIndex}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, email, `Con IG ${testInfo.parallelIndex}`);
  await createStoreViaApi(request, email, legacy);
  await page.reload();
  await expect(page.getByTestId('nav-group-stock')).toBeVisible();
  await openDeskSection(page, 'inventory');
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();

  await openDeskSection(page, 'settings');
  await expect(page.getByTestId('settings-instagram-notice')).toBeVisible();
  await expect(page.getByTestId('settings-instagram-notice')).toContainText('seguir usando la app');
  await shot(page, 'settings-notice-1440');

  await page.getByRole('button', { name: legacy }).click();
  const editor = page.getByRole('dialog', { name: 'Datos de la tienda' });
  await expect(editor.getByLabel('Instagram')).toHaveValue('');
  await editor.getByRole('button', { name: 'Guardar' }).click();
  await expect(editor.getByText('Completá el Instagram de la tienda')).toBeVisible();
  await editor.getByText('Completá el Instagram de la tienda').scrollIntoViewIfNeeded();
  await shot(page, 'settings-editor-1440');
  await editor.getByRole('button', { name: 'Cancelar' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByTestId('settings-instagram-notice')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByTestId('sidebar-tab-more').click();
  await openDeskSection(page, 'settings');
  await expect(page.getByTestId('settings-instagram-notice')).toBeVisible();
  await expect(page.getByTestId('mobile-tab-bar')).toBeVisible();
  await expectFits(page);
  await shot(page, 'settings-notice-390');

  await page.getByRole('button', { name: legacy }).click();
  const phoneEditor = page.getByRole('dialog', { name: 'Tienda' });
  await phoneEditor.getByLabel('Instagram').fill('https://www.instagram.com/casa.norte/');
  await phoneEditor.getByLabel('Instagram').scrollIntoViewIfNeeded();
  await expectFits(page);
  await shot(page, 'settings-editor-390');
  await phoneEditor.getByRole('button', { name: 'Guardar' }).click();
  await expect(phoneEditor).toBeHidden();
  await expect(page.getByTestId('settings-instagram-notice')).toHaveCount(0);
  await expect(page.getByText(/@casa\.norte/)).toBeVisible();
});
