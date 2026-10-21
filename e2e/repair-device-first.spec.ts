import { sheetAction } from './sheet-actions';
import { openDeskSection } from './navigation';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { bootstrapStoreViaApi, buildTestEmail, createRepairViaApi } from './utils';

const SHOTS = 'test-results/repair-hierarchy';

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

async function openService(page: Page) {
  const heading = page.getByRole('heading', { name: 'Servicio técnico' });
  if (await heading.isVisible()) return;
  await openDeskSection(page, 'service');
  await expect(heading).toBeVisible();
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).toBeTruthy();
  return value!;
}

async function expectBelow(upper: Locator, lower: Locator) {
  const top = await box(upper);
  const bottom = await box(lower);
  expect(top.y + top.height).toBeLessThanOrEqual(bottom.y + 2);
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test('the new order puts the device above the optional client on desktop and phone', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const email = buildTestEmail(testInfo, 'repair-device');
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDollar(page);
  await bootstrapStoreViaApi(page, request, email, `Taller equipo ${testInfo.parallelIndex}`);
  await createRepairViaApi(request, email, {
    clientName: 'Ana Pérez',
    device: 'Pixel 8',
    fault: 'Cámara',
    estimate: 80000,
  });
  await openService(page);

  await page.getByRole('button', { name: 'Nueva orden' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
  const device = form.getByLabel('Equipo');
  const client = form.getByRole('combobox', { name: 'Cliente (opcional)' });
  const imei = form.getByLabel('IMEI (opcional)');
  await expect(device).toBeVisible();
  await expect(client).toBeVisible();
  await expectBelow(device, client);
  const deviceBox = await box(device);
  const imeiBox = await box(imei);
  expect(Math.abs(deviceBox.y - imeiBox.y)).toBeLessThan(8);
  await form.getByRole('button', { name: 'Pantalla' }).click();
  await form.getByRole('button', { name: 'Crear orden' }).click();
  await expect(form.locator('.svc-lead-device')).toContainText('Completá este dato');
  await expect(form.locator('.svc-lead-client .err')).toHaveCount(0);
  await form.locator('.sheet-scroll').evaluate((node) => { node.scrollTop = 0; });
  await form.screenshot({ path: `${SHOTS}/nueva-orden-1440x900.png` });

  await device.fill('iPhone 13');
  await form.getByRole('button', { name: 'Crear orden' }).click();
  await expect(form).toBeHidden();
  await page.reload();
  await openService(page);
  const loose = page.locator('[data-testid^="repair-card-"]').filter({ hasText: 'iPhone 13' });
  const linked = page.locator('[data-testid^="repair-card-"]').filter({ hasText: 'Pixel 8' });
  await expect(loose).toBeVisible();
  await expect(linked).toBeVisible();
  await expect(loose.locator('[data-testid^="repair-client-"]')).toHaveCount(0);
  await expect(linked.locator('[data-testid^="repair-client-"]')).toHaveText('Ana Pérez');
  await expectBelow(linked.locator('[data-testid^="repair-device-"]'), linked.locator('[data-testid^="repair-client-"]'));
  await page.screenshot({ path: `${SHOTS}/tablero-1440x900.png` });

  await loose.click();
  const detail = page.getByRole('dialog', { name: /#OT-/ });
  await expect(detail.getByTestId('repair-client')).toHaveCount(0);
  await expect(detail.getByLabel('Equipo')).toHaveCount(0);
  await (await sheetAction(detail, 'Editar')).click();
  const editor = page.getByRole('dialog', { name: 'Editar orden' });
  await expectBelow(editor.getByLabel('Equipo'), editor.getByRole('combobox', { name: 'Cliente (opcional)' }));
  await editor.screenshot({ path: `${SHOTS}/editar-orden-1440x900.png` });
  await editor.getByRole('button', { name: 'Cancelar' }).click();
  await expect(editor).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('mobile-dock')).toBeVisible();
  await openService(page);
  await expect(page.getByTestId('repair-group-RECIBIDO')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/servicio-390x844.png` });
  await page.getByTestId('mobile-dock').getByRole('button', { name: 'Nueva orden' }).click();
  const phoneForm = page.getByRole('dialog', { name: 'Nueva orden de reparación' });
  const phoneDevice = phoneForm.getByLabel('Equipo');
  const phoneClient = phoneForm.getByRole('combobox', { name: 'Cliente (opcional)' });
  const phoneImei = phoneForm.getByLabel('IMEI (opcional)');
  await expectBelow(phoneDevice, phoneClient);
  await expectBelow(phoneClient, phoneImei);
  await phoneForm.getByRole('button', { name: 'Pantalla' }).click();
  await phoneForm.getByRole('button', { name: 'Crear orden' }).click();
  await expect(phoneForm.locator('.svc-lead-device')).toContainText('Completá este dato');
  await expect(phoneForm.locator('.svc-lead-client .err')).toHaveCount(0);
  await phoneForm.locator('.sheet-scroll').evaluate((node) => { node.scrollTop = 0; });
  await phoneForm.screenshot({ path: `${SHOTS}/nueva-orden-390x844.png` });
  await phoneForm.getByRole('button', { name: 'Cerrar' }).click();

  await page.locator('[data-testid^="repair-card-"]').filter({ hasText: 'Pixel 8' }).click();
  const phoneDetail = page.getByRole('dialog', { name: /#OT-/ });
  await expect(phoneDetail.getByText('Pixel 8', { exact: true })).toBeVisible();
  await expect(phoneDetail.getByTestId('repair-client')).toContainText('Ana Pérez');
  await expect(phoneDetail.getByLabel('Equipo')).toHaveCount(0);
  await (await sheetAction(phoneDetail, 'Editar')).click();
  const phoneEditor = page.getByRole('dialog', { name: 'Editar orden' });
  await expectBelow(phoneEditor.getByLabel('Equipo'), phoneEditor.getByRole('combobox', { name: 'Cliente (opcional)' }));
  await phoneEditor.screenshot({ path: `${SHOTS}/editar-orden-390x844.png` });
});
