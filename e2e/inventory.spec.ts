import { expect, test } from '@playwright/test';

import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchInventory, fetchSales, importInventoryViaApi } from './utils';

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

test('creates an item as VENDIDO and registers its sale', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'inventory-created-sold');
  const model = `iPhone Sold At Creation ${Date.now()}`;
  const imei = String(Date.now()).padStart(15, '7').slice(-15);
  await bootstrapStoreViaApi(page, request, email, `Created Sold ${testInfo.parallelIndex}`);
  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('button', { name: 'Registrar equipo' }).click();
  await page.getByLabel('Modelo').fill(model);
  await page.getByLabel('Color').fill('Verde');
  await page.getByLabel('IMEI').fill(imei);
  await page.getByLabel('Precio de venta').fill('2100');
  const createDialog = page.getByRole('dialog', { name: 'Registrar equipo' });
  await createDialog.getByRole('button', { name: 'Vendido', exact: true }).click();
  await createDialog.getByRole('button', { name: 'Guardar equipo' }).click();

  const saleDialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(saleDialog).toBeVisible();
  await expect(saleDialog.getByRole('combobox', { name: 'Equipo' })).toHaveValue(new RegExp(model));
  await saleDialog.getByLabel('Cliente').fill(`Cliente ${Date.now()}`);
  await saleDialog.getByLabel('Precio completo de salida').fill('2100');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(saleDialog).toBeHidden();

  const { inventory } = await fetchInventory(request, email);
  const item = inventory.find((product) => product.imei === imei);
  expect(item).toMatchObject({ model, status: 'VENDIDO', pendingSaleRegistration: false });
  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
  expect(sales[0]?.productId).toBe(item?.id);
});

test('a VENDIDO change can be closed and resumed after reload to register the sale', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'inventory-sale-resume');
  const model = `iPhone Pending Sale ${Date.now()}`;
  const clientName = `Cliente venta pendiente ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Pending Sale ${testInfo.parallelIndex}`);
  const seed = await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '9').slice(-15),
    model,
    price: 1900,
    cost: 1200,
  });
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('row').filter({ hasText: model }).click();
  const detail = page.getByRole('dialog', { name: new RegExp(model) });
  await detail.getByRole('button', { name: 'Vendido' }).click();
  await detail.getByRole('button', { name: 'Guardar estado' }).click();
  await expect(page.getByRole('dialog', { name: 'Registrar venta' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('row').filter({ hasText: model }).getByRole('button', { name: 'Retomar' }).waitFor();
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  const row = page.getByRole('row').filter({ hasText: model });
  await expect(row.getByText('Venta por registrar')).toBeVisible();
  await row.getByRole('button', { name: 'Retomar' }).click();
  const saleDialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(saleDialog.getByRole('combobox', { name: 'Equipo' })).toHaveValue(new RegExp(model));
  await saleDialog.getByLabel('Cliente').fill(clientName);
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(saleDialog).toBeHidden();

  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
  expect(sales[0]?.productId).toBe(seed.inventoryItem.id);
  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.id === seed.inventoryItem.id)).toMatchObject({ status: 'VENDIDO', pendingSaleRegistration: false });
});

test('a zero-price item can be marked sold and its sale registered', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'inventory-zero-price');
  const model = `iPhone Sin Precio ${Date.now()}`;
  const imei = String(Date.now()).padStart(15, '6').slice(-15);
  const clientName = `Cliente precio cero ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Zero Price ${testInfo.parallelIndex}`);
  const imported = await importInventoryViaApi(request, email, { imei, model, price: 0, cost: 400 });
  expect(imported).toMatchObject({ imported: 1, errors: [] });

  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('row').filter({ hasText: model }).click();
  const detail = page.getByRole('dialog', { name: new RegExp(model) });
  await expect(detail.getByText('Sin precio', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Vendido' }).click();
  await detail.getByRole('button', { name: 'Guardar estado' }).click();

  const saleDialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(saleDialog).toBeVisible();
  await expect(saleDialog.getByText('Este equipo no tiene precio')).toBeVisible();
  await saleDialog.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(saleDialog.getByText('Completá el precio de salida', { exact: true })).toBeVisible();
  await saleDialog.getByLabel('Cliente').fill(clientName);
  await saleDialog.getByLabel('Precio completo de salida').fill('2500');
  await saleDialog.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(saleDialog).toBeHidden();

  const { inventory } = await fetchInventory(request, email);
  const item = inventory.find((product) => product.imei === imei);
  expect(item).toMatchObject({ model, status: 'VENDIDO', pendingSaleRegistration: false, price: 2500 });
  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
  expect(sales[0]).toMatchObject({ productId: item?.id, amount: 2500 });
});

test('a device received in a trade-in can be sold after it is marked vendido', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'inventory-tradein-sale');
  const received = `Recibido canje ${Date.now()}`;
  const clientName = `Cliente canje venta ${Date.now()}`;
  const buyer = `Comprador recibido ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Trade Sale ${testInfo.parallelIndex}`);

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const tradeDialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await tradeDialog.getByLabel('Cliente').fill(clientName);
  await tradeDialog.getByLabel('Equipo recibido').fill(received);
  await tradeDialog.getByLabel('Valor tomado').fill('400');
  await tradeDialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo entregado');
  await tradeDialog.getByLabel('Precio completo de salida').fill('900');
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(tradeDialog).toBeHidden();

  const afterTrade = await fetchInventory(request, email);
  const receivedItem = afterTrade.inventory.find((item) => item.model === received);
  expect(receivedItem).toMatchObject({ status: 'EN_REVISION', price: 0 });

  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('row').filter({ hasText: received }).click();
  const detail = page.getByRole('dialog', { name: new RegExp(received) });
  await detail.getByRole('button', { name: 'Vendido' }).click();
  await detail.getByRole('button', { name: 'Guardar estado' }).click();

  const saleDialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(saleDialog).toBeVisible();
  await expect(saleDialog.getByRole('combobox', { name: 'Equipo' })).toHaveValue(new RegExp(received));
  await saleDialog.getByLabel('Cliente').fill(buyer);
  await saleDialog.getByLabel('Precio completo de salida').fill('1100');
  await saleDialog.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(saleDialog).toBeHidden();

  const { inventory } = await fetchInventory(request, email);
  expect(inventory.find((item) => item.id === receivedItem?.id)).toMatchObject({
    status: 'VENDIDO',
    pendingSaleRegistration: false,
    price: 1100,
  });
  const { sales } = await fetchSales(request, email);
  expect(sales.find((sale) => sale.productId === receivedItem?.id)).toMatchObject({ amount: 1100 });
});
