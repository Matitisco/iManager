import { expandListOptions, openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchClients, fetchInventory, fetchSales, fetchTradeIns } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const shots = process.env.ISSUE_328_SHOTS?.trim();
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });

for (const device of [
  { name: 'desktop', mobile: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile-iphone', mobile: true, options: iphone },
]) {
  test.describe(`delete cancelled sales ${device.name}`, () => {
    test.use(device.options);
    test('deletes through the row menu and selection, preserving operation effects after reload', async ({ page, request }, testInfo) => {
      const email = buildTestEmail(testInfo, `delete-cancelled-${device.name}`);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Ventas');
      const headers = authHeaders(email);
      const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', dni: '30111222', pendingBalance: 50 });
      for (let index = 0; index < 3; index++) {
        const { inventoryItem } = await createInventoryItemViaApi(request, email, { imei: `35912345678900${index}`, model: `iPhone ${14 - index}`, price: 950000, cost: 600000 });
        const created = await request.post(`${api}/api/operations/sales`, { headers, data: {
          clientId: client.id, productId: inventoryItem.id, amount: 950000, paymentMethod: 'EFECTIVO', status: index === 0 ? 'PENDIENTE' : 'COMPLETADA',
          ...(index === 1 ? { tradeIn: { deviceReceived: 'iPhone 11', takeValue: 200000 } } : {}),
        } });
        expect(created.status()).toBe(201);
        const { sale } = await created.json();
        if (index === 0) expect((await request.post(`${api}/api/clients/${client.id}/payments`, { headers, data: { amount: 300000, method: 'EFECTIVO' } })).status()).toBe(201);
        expect((await request.post(`${api}/api/operations/sales/sales/${sale.id}/cancel`, { headers, data: {} })).status()).toBe(200);
      }
      const snapshot = async () => ({
        // soldAt and saleId are projections from the sale being deleted, not stock/trade mutations.
        inventory: (await fetchInventory(request, email)).inventory.map(({ soldAt: _soldAt, ...item }) => item),
        clients: await fetchClients(request, email),
        trades: (await fetchTradeIns(request, email)).tradeIns.map(({ saleId: _saleId, ...trade }) => trade),
        payments: await (await request.get(`${api}/api/clients/${client.id}/payments`, { headers })).json(),
      });
      const before = await snapshot();
      const sales = (await fetchSales(request, email)).sales;
      expect(sales).toHaveLength(3);
      await page.reload();
      await openDeskSection(page, 'sales');
      const code = `V-${String(sales[0].saleNumber).padStart(4, '0')}`;
      const record = device.mobile ? page.locator('.phone-row').filter({ hasText: code }) : page.getByRole('row').filter({ hasText: code });
      await expect(record).toContainText('Anulada');
      if (device.mobile) {
        await record.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 300, button: 0 });
        await expect(page.locator('.ctx')).toBeVisible();
        await record.dispatchEvent('pointerup', { pointerType: 'touch' });
        await expect(page.getByRole('checkbox', { name: /^Seleccionar V-/ })).toHaveCount(0);
      } else await record.click({ button: 'right' });
      await page.locator('.ctx').getByRole('button', { name: 'Anular', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: /Anular venta/ });
      await expect(dialog).toContainText('no se puede deshacer');
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/issue-328-${device.name}-delete.png`, animations: 'disabled' });
      }
      await dialog.getByRole('button', { name: 'Anular', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(record).toHaveClass(/is-void/);
      expect((await fetchSales(request, email)).sales).toHaveLength(2);
      expect(await snapshot()).toEqual(before);
      // Local client/stock state must also survive AppContext's delete path.
      await openDeskSection(page, 'clients');
      const clientRow = page.locator(device.mobile ? '.phone-row' : 'tbody tr').filter({ hasText: 'Ana Pérez' });
      const clientRecord = before.clients.clients.find((row) => row.id === client.id)!;
      // The pending sale had no collection of its own. The general payment stays as credit, and the 50 typed on the client stays.
      expect(clientRecord.pendingBalance).toBe(50);
      expect(clientRecord.creditBalance).toBe(300000);
      const net = clientRecord.pendingBalance - (clientRecord.creditBalance ?? 0);
      const formatted = new Intl.NumberFormat('es-AR').format(Math.abs(Math.round(net)));
      await expect(clientRow).toContainText(net > 0 ? `Saldo $ ${formatted}` : net < 0 ? `A favor $ ${formatted}` : 'Sin saldo');
      await expect(device.mobile ? clientRow.locator('.cl-bot span').filter({ hasText: 'Total iManager' }).locator('b') : clientRow.getByRole('cell').nth(5)).toHaveText('$ 0');
      await openDeskSection(page, 'sales');
      await expandListOptions(page);
      if (device.mobile) await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      for (const sale of (await fetchSales(request, email)).sales) await page.getByRole('checkbox', { name: `Seleccionar V-${String(sale.saleNumber).padStart(4, '0')}`, exact: true }).check();
      await page.getByTestId('bulk-action-bar').getByRole('button', { name: 'Anular' }).click();
      const bulk = page.getByRole('dialog', { name: 'Anular: 2 registros' });
      await expect(bulk).toContainText('el historial se conserva en rojo');
      if (shots) await page.screenshot({ path: `${shots}/issue-328-${device.name}-bulk.png`, animations: 'disabled' });
      await bulk.getByRole('button', { name: 'Anular', exact: true }).click();
      await expect(bulk).toBeHidden({ timeout: 20_000 });
      expect((await fetchSales(request, email)).sales).toHaveLength(0);
      expect((await fetchTradeIns(request, email)).tradeIns[0].saleId).toBeNull();
      expect(await snapshot()).toEqual(before);
      await page.reload(); await openDeskSection(page, 'sales');
      await expect(page.locator(device.mobile ? '.sale-node' : 'tbody tr')).toHaveCount(3);
      await expect(page.locator(device.mobile ? '.phone-row.is-void' : 'tbody tr.is-void')).toHaveCount(3);
      expect(await snapshot()).toEqual(before);
      if (shots) await page.screenshot({ path: `${shots}/issue-328-${device.name}-deleted.png`, animations: 'disabled' });
    });
  });
}
