import { sheetAction } from './sheet-actions';
import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchClients, fetchInventory, fetchSales, updateStoreViaApi } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const shots = process.env.ISSUE_315_SHOTS;

async function navigate(page: Page, tab: string) {
  await openDeskSection(page, tab);
}
async function dismiss(page: Page, name?: string) {
  const dialog = name ? page.getByRole('dialog', { name }) : page.getByRole('dialog').last();
  const close = dialog.getByRole('button', { name: 'Cerrar', exact: true }).first();
  if (await close.isVisible()) await close.click();
  else await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}
async function client(page: Page, mobile: boolean) {
  await navigate(page, 'clients');
  await page.locator(mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'Ana Pérez' }).click();
  await expect(page.getByRole('dialog', { name: 'Ana Pérez' })).toBeVisible();
}
async function capture(page: Page, device: string, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/issue-315-${device}-${name}.png`, animations: 'disabled' });
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const sheet = page.getByRole('dialog').last();
  const box = await sheet.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(await sheet.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  const buttons = await sheet.locator('.sheet-foot button').all();
  for (const button of buttons) { const buttonBox = await button.boundingBox(); if (buttonBox) expect(buttonBox.height).toBeGreaterThanOrEqual(44); }
}

export function registerDepositTests(device: { name: string; mobile: boolean }) {
  test('records ARS receipt, reserves, applies frozen USD in payments and restores credit on sale cancellation', async ({ page, request }, info) => {
    test.setTimeout(120000);
    const email = buildTestEmail(info, `deposits-${device.name}`); const headers = authHeaders(email);
    await bootstrapStoreViaApi(page, request, email, 'iManager · Señas');
    await updateStoreViaApi(request, email, { currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
    const { client: customer } = await createClientViaApi(request, email, { name: 'Ana Pérez', dni: '30111222' });
    const { inventoryItem } = await createInventoryItemViaApi(request, email, { model: 'iPhone 14', imei: '359123456789012', price: 500, cost: 300 });
    await page.reload(); await client(page, device.mobile);
    await (await sheetAction(page.getByRole('dialog'), 'Agregar seña')).click();
    const form = page.getByRole('dialog', { name: 'Agregar seña' });
    await form.getByRole('button', { name: 'ARS', exact: true }).click();
    await form.getByLabel('Monto de la seña').fill('100000'); await form.getByLabel('Cotización guardada').fill('1000');
    await form.getByRole('combobox', { name: 'Equipo a reservar (opcional)' }).click();
    await page.getByRole('option', { name: /iPhone 14/ }).click();
    await expect(form).toContainText('USD 100,00'); await fits(page); await capture(page, device.name, 'new-deposit');
    // A rejected write keeps the sheet open and a retry uses its receipt key.
    let rejected = false;
    await page.route(`${api}/api/clients/${customer.id}/deposits`, async route => {
      if (route.request().method() === 'POST' && !rejected) {
        rejected = true;
        await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
        return;
      }
      await route.continue();
    });
    await form.getByRole('button', { name: 'Registrar seña' }).click();
    await expect(form.getByRole('alert')).toBeVisible(); await expect(form).toBeVisible();
    await form.getByRole('button', { name: 'Registrar seña' }).click(); await expect(form).toBeHidden();
    const receipts = await (await request.get(`${api}/api/clients/${customer.id}/deposits`, { headers })).json();
    expect(receipts.deposits).toHaveLength(1); expect(receipts.deposits[0]).toMatchObject({ currency: 'ARS', amount: 100000, exchangeRate: 1000, usdAmount: 100, status: 'ACTIVE' });
    await expect(page.getByRole('dialog', { name: 'Ana Pérez' })).toContainText('Activa');
    await dismiss(page, 'Ana Pérez');
    await navigate(page, 'inventory');
    const stock = page.locator(device.mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'iPhone 14' });
    await expect(stock).toContainText('Ana Pérez'); await stock.click();
    await expect(page.getByRole('dialog')).toContainText('Reservado para Ana Pérez'); await fits(page); await capture(page, device.name, 'reservation');
    await dismiss(page);
    // Move the current quote; the ARS receipt still applies for exactly USD 100.
    await updateStoreViaApi(request, email, { currency: 'USD', exchangeMode: 'manual', manualBuy: 2000, manualSell: 2000 });
    await page.reload(); await client(page, device.mobile);
    await page.getByRole('button', { name: 'Nueva venta' }).click();
    const selling = page.getByRole('dialog', { name: 'Registrar venta' });
    await selling.getByRole('combobox', { name: 'Equipo', exact: true }).fill('iPhone 14');
    await page.getByRole('option', { name: /iPhone 14/ }).click();
    await selling.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await selling.getByRole('button', { name: 'Pendiente', exact: true }).click();
    await expect(selling).toContainText('Señas aplicadas: US$ 100'); await expect(selling).toContainText('Deuda pendiente: US$ 400');
    await fits(page); await selling.locator('.deposit-card').scrollIntoViewIfNeeded(); await capture(page, device.name, 'payments');
    await selling.getByRole('button', { name: 'Confirmar venta' }).click(); await expect(selling).toBeHidden();
    const sales = (await fetchSales(request, email)).sales; expect(sales[0]).toMatchObject({ amount: 500, depositAppliedAmount: 100 });
    expect((await fetchClients(request, email)).clients[0]).toMatchObject({ pendingBalance: 400, totalSpent: 500, balanceCurrency: 'USD' });
    expect((await fetchInventory(request, email)).inventory[0].status).toBe('VENDIDO');
    await page.reload(); await client(page, device.mobile);
    await expect(page.getByRole('dialog', { name: 'Ana Pérez' })).toContainText('Aplicada');
    await dismiss(page, 'Ana Pérez');
    await navigate(page, 'sales'); const sale = page.locator(device.mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'iPhone 14' }); await sale.click();
    await (await sheetAction(page.getByRole('dialog'), 'Cancelar venta')).click();
    const cancel = page.getByRole('dialog', { name: 'Cancelar operación' }); await expect(cancel).toContainText('vuelven como saldo a favor');
    await cancel.getByRole('button', { name: 'Cancelar operación' }).click(); await expect(cancel).toBeHidden();
    await client(page, device.mobile); const detail = page.getByRole('dialog', { name: 'Ana Pérez' }); await expect(detail).toContainText('Saldo a favor');
    await detail.locator('.deposit-card').scrollIntoViewIfNeeded(); await capture(page, device.name, 'history');
    expect((await fetchInventory(request, email)).inventory.find(row => row.id === inventoryItem.id)?.status).toBe('DISPONIBLE');
    const payments = await (await request.get(`${api}/api/clients/${customer.id}/payments`, { headers })).json();
    expect(payments.payments.filter((row: { kind: string }) => row.kind === 'SENA')).toHaveLength(1);
    expect(payments.payments.filter((row: { kind: string }) => row.kind === 'DEVOLUCION')).toHaveLength(0);
  });
  test('cancels to credit or refund, releases stock, and reuses a credit as a repair partial payment', async ({ page, request }, info) => {
    test.setTimeout(120000);
    const email = buildTestEmail(info, `credit-${device.name}`); const headers = authHeaders(email);
    await bootstrapStoreViaApi(page, request, email, 'iManager · Créditos');
    await updateStoreViaApi(request, email, { currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
    const { client: customer } = await createClientViaApi(request, email, { name: 'Ana Pérez', dni: '30111222' });
    const { inventoryItem } = await createInventoryItemViaApi(request, email, { model: 'iPhone 14', imei: '359123456789012', price: 500 });
    const create = async (key: string, productId: string | null) => {
      const result = await request.post(`${api}/api/clients/${customer.id}/deposits`, { headers, data: { amount: 50, currency: 'USD', exchangeRate: 1000, method: 'EFECTIVO', requestKey: key, productId } }); expect(result.status()).toBe(201); return (await result.json()).deposit;
    };
    const deposit = await create('credit', inventoryItem.id);
    await page.reload(); await client(page, device.mobile);
    await page.getByRole('button', { name: 'Cancelar seña' }).click(); const cancel = page.getByRole('dialog', { name: 'Cancelar seña' });
    await fits(page); await capture(page, device.name, 'cancel-credit');
    await cancel.getByRole('button', { name: 'Confirmar saldo a favor' }).click(); await expect(cancel).toBeHidden();
    expect((await fetchInventory(request, email)).inventory[0]).toMatchObject({ status: 'DISPONIBLE', reservedClientId: null });
    const repair = await request.post(`${api}/api/repairs`, { headers, data: { clientId: customer.id, device: 'iPhone 13', fault: 'Pantalla rota', estimate: 200, deposit: 20, currency: 'USD' } }); expect(repair.status()).toBe(201); const order = (await repair.json()).order;
    await page.reload(); await navigate(page, 'service');
    await page.getByText('iPhone 13', { exact: true }).first().click(); await page.getByRole('button', { name: 'Aplicar seña', exact: true }).click();
    const applying = page.getByRole('dialog', { name: 'Aplicar seña a reparación' }); await applying.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await fits(page); await capture(page, device.name, 'repair-payment');
    await applying.getByRole('button', { name: 'Confirmar aplicación' }).click(); await expect(applying).toBeHidden();
    const persisted = await (await request.get(`${api}/api/repairs/${order.id}`, { headers })).json(); expect(persisted.order.deposit).toBe(70);
    expect((await (await request.get(`${api}/api/clients/${customer.id}/deposits`, { headers })).json()).deposits.find((row: { id: string }) => row.id === deposit.id).status).toBe('APPLIED');
    await dismiss(page);
    await create('refund', inventoryItem.id); await page.reload(); await client(page, device.mobile);
    await page.getByRole('button', { name: 'Cancelar seña', exact: true }).click();
    await page.getByRole('button', { name: 'Devolver dinero' }).click(); await page.getByRole('button', { name: 'Confirmar devolución' }).click();
    await expect(page.getByRole('dialog', { name: 'Ana Pérez' })).toContainText('Devuelta');
    const payments = await (await request.get(`${api}/api/clients/${customer.id}/payments`, { headers })).json(); expect(payments.payments.filter((row: { kind: string }) => row.kind === 'DEVOLUCION')).toHaveLength(1);
    await page.reload(); await client(page, device.mobile); await expect(page.getByRole('dialog', { name: 'Ana Pérez' })).toContainText('Devuelta');
  });
}
