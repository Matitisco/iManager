import { expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchClients, fetchInventory, fetchSales, fetchTradeIns } from './utils';

test('free text always makes a new homonymous client; a client-ficha sale keeps the selected client', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'operations-clients');
  const clientName = `Cliente repetido ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Operations ${testInfo.parallelIndex}`);

  await page.getByTestId('sidebar-tab-sales').click();
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  let dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo por texto 1');
  await dialog.getByLabel('Precio completo de salida').fill('1200');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(dialog).toBeHidden();

  const firstClients = await fetchClients(request, email);
  expect(firstClients.clients.filter((client) => client.name === clientName)).toHaveLength(1);
  const firstSales = await fetchSales(request, email);
  const originalClientId = firstSales.sales.find((sale) => sale.amount === 1200)?.clientId;
  expect(originalClientId).toBeTruthy();

  await page.getByRole('button', { name: 'Registrar venta' }).click();
  dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo por texto 1 duplicado');
  await dialog.getByLabel('Precio completo de salida').fill('1300');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(dialog).toBeHidden();
  const duplicateClients = await fetchClients(request, email);
  expect(duplicateClients.clients.filter((client) => client.name === clientName)).toHaveLength(2);

  await page.reload();
  await page.getByTestId('sidebar-tab-clients').click();
  await page.getByTestId(`client-row-${originalClientId}`).click();
  await page.getByRole('button', { name: 'Nueva venta' }).click();
  dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await expect(dialog.getByLabel('Cliente')).toHaveValue(clientName);
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo por texto 2');
  await dialog.getByLabel('Precio completo de salida').fill('1400');
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  await expect(dialog).toBeHidden();

  const clients = await fetchClients(request, email);
  const sameName = clients.clients.filter((client) => client.name === clientName);
  expect(sameName).toHaveLength(2);
  const sales = await fetchSales(request, email);
  expect(sales.sales).toHaveLength(3);
  expect(sales.sales.find((sale) => sale.amount === 1200)?.clientId).toBe(originalClientId);
  expect(sales.sales.find((sale) => sale.amount === 1300)?.clientId).not.toBe(originalClientId);
  expect(sales.sales.find((sale) => sale.amount === 1400)?.clientId).toBe(originalClientId);
});

test('a trade-in saved as pending resumes after reload and confirms with zero difference', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'operations-draft');
  const received = `Equipo recibido ${Date.now()}`;
  const clientName = `Cliente canje ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Operations Draft ${testInfo.parallelIndex}`);

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  let dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Equipo recibido').fill(received);
  await dialog.getByLabel('Valor tomado').fill('0');
  await page.getByRole('button', { name: 'Guardar pendiente' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Canjes pendientes de confirmar')).toBeVisible();

  await page.reload();
  await page.getByTestId('sidebar-tab-tradeins').click();
  await expect(page.getByText('Canjes pendientes de confirmar')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).click();
  dialog = page.getByRole('dialog', { name: 'Retomar canje' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo libre recibido');
  await dialog.getByLabel('Precio completo de salida').fill('0');
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(dialog).toBeHidden();

  const clients = await fetchClients(request, email);
  expect(clients.clients.filter((client) => client.name === clientName)).toHaveLength(1);
  const trades = await fetchTradeIns(request, email);
  expect(trades.tradeIns).toHaveLength(1);
  expect(trades.tradeIns[0]?.deviceReceived).toBe(received);
  expect(trades.tradeIns[0]?.differencePaid).toBe(0);
  const sales = await fetchSales(request, email);
  expect(sales.sales).toHaveLength(1);
  expect(sales.sales[0]?.amount).toBe(0);
  const inventory = await fetchInventory(request, email);
  expect(inventory.inventory).toHaveLength(1);
  expect(inventory.inventory[0]).toMatchObject({ model: received, status: 'EN_REVISION', capacity: '', color: '', condition: '', grade: '', batteryHealth: '', price: 0, cost: 0, imei: '' });
});

test('a Ventas-origin draft is recoverable after reload', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'sales-draft');
  const received = `Equipo draft ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Sales Draft ${testInfo.parallelIndex}`);

  await page.getByTestId('sidebar-tab-sales').click();
  await page.getByRole('button', { name: 'Registrar venta' }).click();
  let dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByRole('checkbox', { name: 'Tiene canje' }).check();
  dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Equipo recibido').fill(received);
  await dialog.getByLabel('Valor tomado').fill('500');
  await page.getByRole('button', { name: 'Guardar pendiente' }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByTestId('sidebar-tab-sales').click();
  await expect(page.getByText('Canjes pendientes de confirmar')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).click();
  await expect(page.getByRole('dialog', { name: 'Retomar canje' })).toBeVisible();
  const clients = await fetchClients(request, email);
  expect(clients.clients).toHaveLength(0);
  const sales = await fetchSales(request, email);
  expect(sales.sales).toHaveLength(0);
  const trades = await fetchTradeIns(request, email);
  expect(trades.tradeIns).toHaveLength(1);
  expect(trades.tradeIns[0]?.status).toBe('PENDIENTE');
  expect(trades.tradeIns[0]?.confirmationStatus).toBe('PENDING');
});

test('a linked canje edit updates both records and cancellation keeps the client and history', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'linked-trade-edit');
  const clientName = `Cliente edición ${Date.now()}`;
  const received = `Equipo editar ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Linked Trade ${testInfo.parallelIndex}`);

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  let dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByLabel('Equipo recibido').fill(received);
  await dialog.getByLabel('Valor tomado').fill('1000');
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo libre inicial');
  await dialog.getByLabel('Precio completo de salida').fill('1500');
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('row').filter({ hasText: received }).click();
  let detail = page.getByRole('dialog');
  await expect(detail.getByText('Canje confirmado')).toBeVisible();
  await detail.getByRole('button', { name: 'Editar' }).click();
  dialog = page.getByRole('dialog', { name: 'Editar operación' });
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo libre editado');
  await dialog.getByLabel('Valor tomado').fill('1100');
  await dialog.getByLabel('Precio completo de salida').fill('1600');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(dialog).toBeHidden();

  const updatedSales = await fetchSales(request, email);
  expect(updatedSales.sales).toHaveLength(1);
  expect(updatedSales.sales[0]).toMatchObject({ amount: 1600, status: 'COMPLETADA', deviceLabel: 'Equipo libre editado' });
  const updatedTrades = await fetchTradeIns(request, email);
  expect(updatedTrades.tradeIns[0]).toMatchObject({ takeValue: 1100, differencePaid: 500, deviceGiven: 'Equipo libre editado' });

  await page.getByRole('row').filter({ hasText: received }).click();
  detail = page.getByRole('dialog');
  await detail.getByRole('button', { name: 'Cancelar operación' }).click();
  await expect(page.getByText(/Operación cancelada/).last()).toBeVisible();
  const afterCancelSales = await fetchSales(request, email);
  expect(afterCancelSales.sales[0]?.status).toBe('CANCELADA');
  const afterCancelClients = await fetchClients(request, email);
  expect(afterCancelClients.clients.filter((client) => client.name === clientName)).toHaveLength(1);
  const afterCancelInventory = await fetchInventory(request, email);
  expect(afterCancelInventory.inventory.some((item) => item.model === received)).toBeFalsy();
});

test('a failed linked confirmation keeps the form and entered values open', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'linked-trade-error');
  const duplicateImei = String(Date.now()).padStart(15, '4').slice(-15);
  await bootstrapStoreViaApi(page, request, email, `Linked Error ${testInfo.parallelIndex}`);
  await createInventoryItemViaApi(request, email, { imei: duplicateImei, model: `IMEI holder ${Date.now()}`, price: 1500 });

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Cliente').fill(`Cliente error ${Date.now()}`);
  await dialog.getByLabel('Equipo recibido').fill('Equipo con IMEI duplicado');
  await dialog.getByLabel('IMEI recibido').fill(duplicateImei);
  await dialog.getByLabel('Valor tomado').fill('100');
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo libre');
  await dialog.getByLabel('Precio completo de salida').fill('900');
  await dialog.screenshot({ path: `${process.env.TEMP ?? '.'}/iManager-issue89-operation-form.png` });
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Ya existe un equipo con ese IMEI/)).toBeVisible();
  await expect(dialog.getByLabel('Equipo recibido')).toHaveValue('Equipo con IMEI duplicado');
  await expect(dialog.getByLabel('IMEI recibido')).toHaveValue(duplicateImei);
});

test('Inventory and Client-origin drafts can be resumed from their own sections', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'source-drafts');
  const clientName = `Cliente source ${Date.now()}`;
  await bootstrapStoreViaApi(page, request, email, `Source Drafts ${testInfo.parallelIndex}`);
  const product = await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '3').slice(-15),
    model: `Equipo stock ${Date.now()}`,
    price: 1800,
  });

  await page.reload();
  await page.getByTestId('sidebar-tab-clients').click();
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  const clientDialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await clientDialog.getByLabel('Nombre y apellido').fill(clientName);
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(clientDialog).toBeHidden();
  const createdClients = await fetchClients(request, email);
  const clientId = createdClients.clients.find((client) => client.name === clientName)?.id;
  expect(clientId).toBeTruthy();

  await page.getByTestId('sidebar-tab-inventory').click();
  await page.getByRole('row').filter({ hasText: product.inventoryItem.model }).click();
  await page.getByRole('button', { name: 'Vender' }).click();
  let dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByRole('checkbox', { name: 'Tiene canje' }).check();
  dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Equipo recibido').fill(`Recibido inventario ${Date.now()}`);
  await dialog.getByLabel('Valor tomado').fill('500');
  await page.getByRole('button', { name: 'Guardar pendiente' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByTestId('sidebar-tab-inventory').click();
  await expect(page.getByText('Canjes pendientes de confirmar')).toBeVisible();
  await page.getByRole('button', { name: /Retomar/ }).click();
  dialog = page.getByRole('dialog', { name: 'Retomar canje' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('option', { name: new RegExp(clientName) }).click();
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(dialog).toBeHidden();

  await page.getByTestId('sidebar-tab-clients').click();
  await page.getByTestId(`client-row-${clientId}`).click();
  await page.getByRole('button', { name: 'Nueva venta' }).click();
  dialog = page.getByRole('dialog', { name: 'Registrar venta' });
  await dialog.getByRole('checkbox', { name: 'Tiene canje' }).check();
  dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Equipo recibido').fill(`Recibido cliente ${Date.now()}`);
  await dialog.getByLabel('Valor tomado').fill('300');
  await page.getByRole('button', { name: 'Guardar pendiente' }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByTestId('sidebar-tab-clients').click();
  await expect(page.getByText('Canjes pendientes de confirmar')).toBeVisible();
  await page.getByRole('button', { name: /Retomar/ }).click();
  dialog = page.getByRole('dialog', { name: 'Retomar canje' });
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo cliente libre');
  await dialog.getByLabel('Precio completo de salida').fill('900');
  await page.getByRole('button', { name: 'Confirmar canje' }).click();
  await expect(dialog).toBeHidden();

  const finalClients = await fetchClients(request, email);
  expect(finalClients.clients).toHaveLength(1);
  expect(finalClients.clients[0]?.id).toBe(clientId);
  const finalSales = await fetchSales(request, email);
  expect(finalSales.sales).toHaveLength(2);
  expect(finalSales.sales.every((sale) => sale.clientId === clientId)).toBeTruthy();
});
