import { openDeskSection } from './navigation';
import { expect, test } from '@playwright/test';

import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  fetchClients,
  fetchInventory,
  fetchSales,
} from './utils';

test('@smoke creates a sale from available inventory and persists client and stock changes', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'sales');
  const storeName = `Sales Store ${testInfo.parallelIndex}`;
  const productModel = `iPhone Sale ${Date.now()}`;
  const clientName = `Cliente Venta ${Date.now()}`;
  const clientDni = `40${Date.now().toString().slice(-6)}`;

  await bootstrapStoreViaApi(page, request, email, storeName);
  const productSeed = await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '7').slice(-15),
    model: productModel,
    price: 1800,
    cost: 1200,
  });
  await page.reload();
  await expect(page.getByTestId('nav-group-comercial')).toBeVisible();

  await openDeskSection(page, 'clients');
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  const clientDialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await clientDialog.getByLabel('Nombre y apellido').fill(clientName);
  await clientDialog.getByLabel('DNI').fill(clientDni);
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cliente' })).toBeHidden();

  await openDeskSection(page, 'sales');
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(dialog.getByRole('option')).toHaveCount(0);
  await dialog.getByLabel('Equipo').fill(productModel);
  await dialog.getByRole('option', { name: new RegExp(productModel) }).click();
  await expect(dialog.getByLabel('Equipo')).toHaveValue(new RegExp(productModel));
  await dialog.getByLabel('Cliente').fill(clientName);
  await page.getByRole('button', { name: 'Confirmar venta' }).click();

  await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeHidden();
  await expect(page.getByText(clientName)).toBeVisible();

  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
  expect(sales[0]?.productId).toBe(productSeed.inventoryItem.id);
  expect(sales[0]?.status).toBe('COMPLETADA');

  const { clients } = await fetchClients(request, email);
  expect(clients.some((client) => client.dni === clientDni && client.name === clientName)).toBeTruthy();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.id === productSeed.inventoryItem.id)?.status).toBe('VENDIDO');
});
