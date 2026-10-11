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

test('requires instagram while creating the store', async ({ page }, testInfo) => {
  const email = buildTestEmail(testInfo, 'ig-onboarding');
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginViaUi(page, email);
  const name = page.getByTestId('onboarding-store-name');
  await expect(name).toBeVisible();
  await expect(page.getByTestId('onboarding-instagram')).toBeVisible();
  await name.fill('Casa Norte');
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('onboarding-instagram-error')).toHaveText('Completá el Instagram de la tienda');
  const submit = page.getByTestId('onboarding-submit');
  await submit.scrollIntoViewIfNeeded();
  const submitBox = await submit.boundingBox();
  const viewport = page.viewportSize();
  expect(submitBox && viewport && submitBox.y >= 0 && submitBox.y + submitBox.height <= viewport.height + 1).toBeTruthy();
  await shot(page, 'onboarding-1440');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('onboarding-instagram').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('onboarding-instagram')).toBeVisible();
  await expectFits(page);
  await shot(page, 'onboarding-390');

  await page.getByTestId('onboarding-instagram').fill('mi tienda');
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('onboarding-instagram-error')).toHaveText('Usá @usuario o el link del perfil');
  await shot(page, 'onboarding-390-error');
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
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();

  await page.getByTestId('sidebar-tab-settings').click();
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
  await page.getByTestId('sidebar-tab-settings').click();
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
