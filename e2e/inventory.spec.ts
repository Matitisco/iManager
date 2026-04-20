import { expect, test } from '@playwright/test';

import { bootstrapStoreViaApi, buildTestEmail, fetchInventory } from './utils';

test('creates an inventory item from the UI and persists it', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'inventory');
  const storeName = `Inventory Store ${testInfo.parallelIndex}`;
  const imei = `E2E-INV-${Date.now()}`;
  const model = `iPhone Inventory ${Date.now()}`;

  await bootstrapStoreViaApi(page, request, email, storeName);
  await page.getByTestId('sidebar-tab-inventory').click({ noWaitAfter: true });
  await expect(page.getByTestId('header-new-action')).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByTestId('header-new-action').click({ noWaitAfter: true });

  await page.getByLabel('IMEI').fill(imei);
  await page.getByLabel('Modelo').fill(model);
  await page.getByLabel('Color').fill('Blue');
  await page.getByLabel('Costo ($)').fill('900');
  await page.getByLabel('Precio Venta ($)').fill('1400');
  await page.getByRole('button', { name: /Guardar Equipo/i }).click();

  await expect(page.getByRole('button', { name: /Guardar Equipo/i })).toBeHidden();

  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click({ noWaitAfter: true });
  await expect(page.getByText(model)).toBeVisible();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.some((item) => item.imei === imei && item.model === model)).toBeTruthy();
});
