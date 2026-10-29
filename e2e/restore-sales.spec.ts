import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openDeskSection } from './navigation';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchSales } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
const shots = process.env.ANULADAS_SHOTS;
for (const phone of [false, true]) {
  test.describe(`restore annulled sales ${phone ? 'mobile' : 'desktop'}`, () => {
    test.use({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
    test('orders, confirms, restores and persists after reload', async ({ page, request }, info) => {
      const email = buildTestEmail(info, 'restore-sales');
      await bootstrapStoreViaApi(page, request, email, 'iStore · Ventas');
      const headers = authHeaders(email);
      const { client } = await createClientViaApi(request, email, { name: 'Ana Pérez', dni: '30111222' });
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        const { inventoryItem } = await createInventoryItemViaApi(request, email, { imei: `35912345678000${i}`, model: `iPhone ${12 + i}`, capacity: '128 GB', price: 950000, cost: 600000 });
        const response = await request.post(`${api}/api/operations/sales`, { headers, data: { clientId: client.id, productId: inventoryItem.id, amount: 950000, currency: 'ARS', exchangeRate: 1565, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' } });
        expect(response.status()).toBe(201);
        ids.push((await response.json()).sale.id);
        if (i === 1 || i === 3) expect((await request.post(`${api}/api/operations/sales/sales/${ids[i]}/${i === 1 ? 'cancel' : 'void'}`, { headers, data: {} })).status()).toBe(200);
      }
      await page.reload(); await openDeskSection(page, 'sales');
      const records = page.locator(phone ? '.sale-node' : 'tbody tr');
      await expect(records).toHaveCount(4);
      await expect(records.nth(0)).not.toHaveClass(/is-void|cancelled/);
      await expect(records.nth(1)).not.toHaveClass(/is-void|cancelled/);
      await expect(records.nth(2)).toHaveClass(/is-void|cancelled/);
      await expect(records.nth(3)).toHaveClass(/is-void|cancelled/);
      const rows = phone ? page.locator('.phone-row') : records;
      const annulled = rows.filter({ hasText: 'V-0004' });
      const snapshot = async (name: string) => {
        if (!shots) return;
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/${phone ? '390' : '1440'}-${name}.png`, animations: 'disabled' });
      };
      await rows.last().scrollIntoViewIfNeeded();
      await snapshot('orden');
      const openMenu = async () => {
        if (phone) {
          await annulled.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 300, button: 0 });
          await expect(page.locator('.ctx')).toBeVisible();
          await annulled.dispatchEvent('pointerup', { pointerType: 'touch' });
        } else await annulled.click({ button: 'right' });
      };
      await openMenu();
      await expect(page.locator('.ctx').getByRole('button', { name: 'Revertir anulación', exact: true })).toBeVisible();
      await snapshot('menu');
      await page.getByRole('button', { name: 'Revertir anulación', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '¿Revertir anulación?' });
      await expect(dialog).toContainText('V-0004');
      await snapshot('confirmacion');
      expect((await fetchSales(request, email)).sales.some(sale => sale.id === ids[3])).toBe(false);
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(annulled).toHaveClass(/is-void/);
      await openMenu();
      await page.getByRole('button', { name: 'Revertir anulación', exact: true }).click();
      await dialog.getByRole('button', { name: 'Revertir anulación', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(annulled).not.toHaveClass(/is-void/);
      await expect(annulled).toContainText('Completada');
      await page.reload(); await openDeskSection(page, 'sales');
      await expect(rows.filter({ hasText: 'V-0004' })).toContainText('Completada');
      await expect(records.last()).toContainText('V-0002');
      await rows.filter({ hasText: 'V-0004' }).scrollIntoViewIfNeeded();
      await snapshot('revertida');
      const inventory = await (await request.get(`${api}/api/inventory`, { headers })).json();
      expect(inventory.inventory.find((item: { model: string }) => item.model === 'iPhone 15').status).toBe('VENDIDO');
    });
  });
}
