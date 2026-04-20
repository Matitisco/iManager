import { expect, test } from '@playwright/test';

import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  fetchClients,
  fetchInventory,
  fetchSales,
} from './utils';

test('creates a sale from available inventory and persists client and stock changes', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'sales');
  const storeName = `Sales Store ${testInfo.parallelIndex}`;
  const productModel = `iPhone Sale ${Date.now()}`;
  const clientName = `Cliente Venta ${Date.now()}`;
  const clientDni = `40${Date.now().toString().slice(-6)}`;

  await bootstrapStoreViaApi(page, request, email, storeName);
  const productSeed = await createInventoryItemViaApi(request, email, {
    imei: `E2E-SALE-${Date.now()}`,
    model: productModel,
    price: 1800,
    cost: 1200,
  });
  await page.reload();

  await page.getByTestId('sidebar-tab-sales').click({ noWaitAfter: true });
  await expect(page.getByTestId('header-new-action')).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByTestId('header-new-action').click({ noWaitAfter: true });
  await page.locator('form').getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel(/DNI \/ ID/i).fill(clientDni);
  await page.getByLabel(/Nombre Completo/i).fill(clientName);
  await page.getByRole('button', { name: /Registrar Venta/i }).click();

  await expect(page.getByRole('button', { name: /Registrar Venta/i })).toBeHidden();
  await expect(page.getByText(/1 ventas/i)).toBeVisible();

  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
  expect(sales[0]?.productId).toBe(productSeed.inventoryItem.id);
  expect(sales[0]?.status).toBe('COMPLETADA');

  const { clients } = await fetchClients(request, email);
  expect(clients.some((client) => client.dni === clientDni && client.name === clientName)).toBeTruthy();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.id === productSeed.inventoryItem.id)?.status).toBe('VENDIDO');
});
