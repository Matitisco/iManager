import { expect, test } from '@playwright/test';

import { bootstrapStoreViaApi, buildTestEmail, fetchInventory } from './utils';

test('creates an inventory item from the UI and persists it', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'inventory');
  const storeName = `Inventory Store ${testInfo.parallelIndex}`;
  const imei = String(Date.now()).padStart(15, '8').slice(-15);
  const model = `iPhone Inventory ${Date.now()}`;

  await bootstrapStoreViaApi(page, request, email, storeName);
  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();

  await page.getByLabel('Modelo').fill(model);
  await page.getByLabel('Color').fill('Azul');
  await page.getByLabel('IMEI').fill(imei);
  await page.getByLabel('Precio de venta').fill('1400');
  await page.getByRole('button', { name: 'Guardar equipo' }).click();

  await expect(page.getByRole('button', { name: 'Guardar equipo' })).toBeHidden();
  await expect(page.getByText(model)).toBeVisible();

  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText(model)).toBeVisible();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.some((item) => item.imei === imei && item.model === model)).toBeTruthy();
});
