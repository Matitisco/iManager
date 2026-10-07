import { expect, test } from '@playwright/test';

import {
  bootstrapStoreViaApi,
  buildTestEmail,
  createInventoryItemViaApi,
  fetchClients,
  fetchTradeIns,
} from './utils';

test('creates a trade-in flow and persists the result', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'trade-ins');
  const storeName = `TradeIn Store ${testInfo.parallelIndex}`;
  const seededProduct = `iPhone Trade ${Date.now()}`;
  const receivedDevice = `Galaxy Used ${Date.now()}`;
  const clientName = `Cliente Canje ${Date.now()}`;
  const clientDni = `41${Date.now().toString().slice(-6)}`;

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
  await clientDialog.getByLabel('DNI').fill(clientDni);
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cliente' })).toBeHidden();

  await page.getByTestId('sidebar-tab-tradeins').click();
  await page.getByRole('button', { name: 'Nuevo canje' }).click();
  await page.getByLabel('Equipo que recibís').fill(receivedDevice);
  await page.getByLabel('IMEI recibido').fill(String(Date.now()).padStart(15, '5').slice(-15));
  await page.getByLabel('Valor tomado').fill('1000');
  await page.getByRole('button', { name: 'Crear canje' }).click();

  await expect(page.getByRole('button', { name: 'Crear canje' })).toBeHidden();
  await expect(page.getByText(receivedDevice).first()).toBeVisible();

  const { tradeIns } = await fetchTradeIns(request, email);
  expect(tradeIns).toHaveLength(1);
  expect(tradeIns[0]?.deviceReceived).toBe(receivedDevice);
  expect(tradeIns[0]?.status).toBe('PENDIENTE');

  const { clients } = await fetchClients(request, email);
  expect(clients.some((client) => client.dni === clientDni && client.name === clientName)).toBeTruthy();
});
