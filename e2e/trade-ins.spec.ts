import { expect, test } from '@playwright/test';

import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  fetchClients,
  fetchSales,
  fetchTradeIns,
} from './utils';

test('confirms a free-output trade-in and persists a new sale and received device', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'trade-ins');
  const storeName = `TradeIn Store ${testInfo.parallelIndex}`;
  const seededProduct = `iPhone Trade ${Date.now()}`;
  const receivedDevice = `Galaxy Used ${Date.now()}`;
  const clientName = `Cliente Canje ${Date.now()}`;

  await bootstrapStoreViaApi(page, request, email, storeName);
  await createInventoryItemViaApi(request, email, {
    imei: String(Date.now()).padStart(15, '6').slice(-15),
    model: seededProduct,
    price: 1700,
    cost: 1100,
  });
  await page.reload();
  await expect(page.getByTestId('sidebar-tab-clients')).toBeVisible();

  await page.getByTestId('sidebar-tab-clients').click();
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  const clientDialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await clientDialog.getByLabel('Nombre y apellido').fill(clientName);
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cliente' })).toBeHidden();

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo canje' });
  await dialog.getByLabel('Cliente').fill(clientName);
  await dialog.getByRole('option', { name: new RegExp(clientName) }).click();
  await dialog.getByLabel('Equipo recibido').fill(receivedDevice);
  await dialog.getByLabel('Valor tomado').fill('1000');
  await dialog.getByRole('combobox', { name: 'Equipo' }).fill('Equipo libre');
  await dialog.getByLabel('Precio completo de salida').fill('1500');
  await page.getByRole('button', { name: 'Confirmar canje' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(receivedDevice).first()).toBeVisible();
  await page.getByRole('row').filter({ hasText: receivedDevice }).click();
  await page.getByRole('dialog').screenshot({ path: `${process.env.TEMP ?? '.'}/iManager-issue89-received-review.png` });

  const { clients } = await fetchClients(request, email);
  const client = clients.find((item) => item.name === clientName);
  expect(client).toBeTruthy();

  const { tradeIns } = await fetchTradeIns(request, email);
  expect(tradeIns).toHaveLength(1);
  expect(tradeIns[0]?.deviceReceived).toBe(receivedDevice);
  expect(tradeIns[0]?.status).toBe('PENDIENTE');
  expect(tradeIns[0]?.clientId).toBe(client?.id);
  expect(tradeIns[0]?.clientName).toBe(clientName);
  expect(tradeIns[0]?.deviceGiven).toBe('Equipo libre');
  expect(tradeIns[0]?.differencePaid).toBe(500);

  const { sales } = await fetchSales(request, email);
  expect(sales).toHaveLength(1);
  expect(sales[0]?.amount).toBe(1500);
  expect(sales[0]?.clientId).toBe(client?.id);
});
