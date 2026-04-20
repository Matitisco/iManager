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
    imei: `E2E-TRADE-${Date.now()}`,
    model: seededProduct,
    price: 1700,
    cost: 1100,
  });
  await page.reload();

  await page.getByTestId('sidebar-tab-tradeins').click({ noWaitAfter: true });
  await expect(page.getByTestId('header-new-action')).toBeVisible();
  await page.waitForTimeout(300);
  await page.getByTestId('header-new-action').click({ noWaitAfter: true });
  await page.locator('form').getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByLabel(/DNI \/ ID/i).fill(clientDni);
  await page.getByLabel(/Nombre Completo/i).fill(clientName);
  await page.getByLabel('Equipo Recibido').fill(receivedDevice);
  await page.getByLabel('IMEI Recibido').fill(`REC-${Date.now()}`);
  await page.getByLabel('Valor de Toma ($)').fill('1000');
  await page.getByRole('button', { name: /Registrar Canje/i }).click();

  await expect(page.getByRole('button', { name: /Registrar Canje/i })).toBeHidden();
  await expect(page.getByRole('button', { name: receivedDevice }).first()).toBeVisible();

  const { tradeIns } = await fetchTradeIns(request, email);
  expect(tradeIns).toHaveLength(1);
  expect(tradeIns[0]?.deviceReceived).toBe(receivedDevice);
  expect(tradeIns[0]?.status).toBe('PENDIENTE');

  const { clients } = await fetchClients(request, email);
  expect(clients.some((client) => client.dni === clientDni && client.name === clientName)).toBeTruthy();
});
