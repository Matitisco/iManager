import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchClients, fetchInventory, fetchSales, fetchTradeIns } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const shots = process.env.ISSUE_335_SHOTS?.trim();
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });
test.describe.configure({ mode: 'serial' });

async function openTradeIns(page: import('@playwright/test').Page) {
  await openDeskSection(page, 'tradeins');
}

for (const device of [
  { name: 'desktop', mobile: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile', mobile: true, options: iphone },
]) {
  test.describe(`delete cancelled trade-ins ${device.name}`, () => {
    test.use(device.options);
    test('deletes through the row menu and selection and stays gone after reload', async ({ page, request }, testInfo) => {
      const email = buildTestEmail(testInfo, `delete-cancelled-trade-${device.name}`);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Canjes');
      const headers = authHeaders(email);
      const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', dni: '30111222', pendingBalance: 50 });
      const tradeIds: string[] = [];
      for (let index = 0; index < 3; index++) {
        const { inventoryItem } = await createInventoryItemViaApi(request, email, { imei: `35998765432100${index}`, model: `iPhone ${14 - index}`, price: 950000, cost: 600000 });
        const created = await request.post(`${api}/api/operations/sales`, { headers, data: {
          clientId: client.id, productId: inventoryItem.id, amount: 950000, paymentMethod: 'EFECTIVO', status: index === 0 ? 'PENDIENTE' : 'COMPLETADA',
          tradeIn: { deviceReceived: `Recibido ${index}`, takeValue: 200000 },
        } });
        if (!created.ok()) throw new Error(`${created.status()} ${await created.text()}`);
        const body = await created.json();
        tradeIds.push(body.tradeIn.id);
        if (index === 0) {
          const payment = await request.post(`${api}/api/clients/${client.id}/payments`, { headers, data: { amount: 300000, method: 'EFECTIVO' } });
          if (!payment.ok()) throw new Error(`${payment.status()} ${await payment.text()}`);
        }
        const cancelled = await request.post(`${api}/api/operations/sales/sales/${body.sale.id}/cancel`, { headers, data: {} });
        if (!cancelled.ok()) throw new Error(`${cancelled.status()} ${await cancelled.text()}`);
      }
      const released = (await fetchInventory(request, email)).inventory.find((item) => item.model === 'iPhone 14')!;
      const resale = await request.post(`${api}/api/operations/sales`, { headers, data: {
        clientId: client.id, productId: released.id, amount: 970000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
      } });
      expect(resale.status()).toBe(201);
      const stable = (row: object) => {
        const copy = { ...(row as Record<string, unknown>) };
        delete copy.soldAt;
        delete copy.updatedAt;
        delete copy.tradeInId;
        return copy;
      };
      const snapshot = async () => ({
        inventory: (await fetchInventory(request, email)).inventory.map(stable),
        clients: await fetchClients(request, email),
        payments: await (await request.get(`${api}/api/clients/${client.id}/payments`, { headers })).json(),
        sales: (await fetchSales(request, email)).sales.map(stable),
      });
      const before = await snapshot();
      expect((await fetchTradeIns(request, email)).tradeIns).toHaveLength(3);
      await page.reload();
      await openTradeIns(page);
      const record = device.mobile ? page.locator('.phone-row').filter({ hasText: 'Recibido 2' }) : page.getByRole('row').filter({ hasText: 'Recibido 2' });
      await expect(record).toContainText('Anulada');
      if (device.mobile) {
        await record.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 300, button: 0 });
        await expect(page.locator('.ctx')).toBeVisible();
        await record.dispatchEvent('pointerup', { pointerType: 'touch' });
        await expect(page.getByRole('checkbox', { name: /^Seleccionar C-/ })).toHaveCount(0);
      } else await record.click({ button: 'right' });
      await page.locator('.ctx').getByRole('button', { name: 'Anular', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Anular canje' });
      await expect(dialog).toContainText('no se puede deshacer');
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/issue-335-${device.name}-delete.png`, animations: 'disabled' });
      }
      await dialog.getByRole('button', { name: 'Anular', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText('Anulado', { exact: true })).toBeVisible();
      await expect(record).toHaveClass(/is-void/);
      expect((await fetchTradeIns(request, email)).tradeIns).toHaveLength(2);
      expect(await snapshot()).toEqual(before);
      await openTradeIns(page);
      if (device.mobile) await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
      for (const trade of (await fetchTradeIns(request, email)).tradeIns) await page.getByRole('checkbox', { name: `Seleccionar C-${String(trade.tradeNumber).padStart(4, '0')}`, exact: true }).check();
      await page.getByTestId('bulk-action-bar').getByRole('button', { name: 'Anular' }).click();
      const bulk = page.getByRole('dialog', { name: 'Anular: 2 registros' });
      await expect(bulk).toContainText('Se restauran stock y saldos');
      if (shots) await page.screenshot({ path: `${shots}/issue-335-${device.name}-bulk.png`, animations: 'disabled' });
      await bulk.getByRole('button', { name: 'Anular', exact: true }).click();
      await expect(bulk).toBeHidden();
      expect((await fetchTradeIns(request, email)).tradeIns).toHaveLength(0);
      expect(await snapshot()).toEqual(before);
      await page.reload();
      await openTradeIns(page);
      await expect(page.locator(device.mobile ? '.phone-row.is-void' : 'tbody tr.is-void')).toHaveCount(3);
      expect(await snapshot()).toEqual(before);
      if (shots) await page.screenshot({ path: `${shots}/issue-335-${device.name}-deleted.png`, animations: 'disabled' });
    });
  });
}
