import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, fetchSales, fetchTradeIns, fetchInventory, createInventoryItemViaApi } from './utils';

const shots = process.env.ISSUE_146_SHOTS;

async function openEditor(page: Page, phone: boolean) {
  if (phone) await page.getByTestId('row-menu').click();
  else {
    await page.getByRole('row').filter({ hasText: 'Ana Pérez' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Editar', exact: true }).click();
  }
  if (phone) await page.locator('.ctx').getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar operación' });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const device of [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, phone: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, phone: true },
]) {
  test.describe(device.name, () => {
    test.use({ viewport: device.viewport });
    test('adds, changes and removes a trade-in while editing the same sale', async ({ page, request }) => {
      const email = `canje-${device.name}-${Date.now()}@imanager.test`;
      await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-11T12:00:00-03:00' } }));
      await bootstrapStoreViaApi(page, request, email, 'iManager · Ventas');
      const product = await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 14', capacity: '128GB', price: 650000 });
      await page.reload();
      await page.getByTestId('sidebar-tab-sales').click();
      await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
      await (device.phone ? page.getByTestId('mobile-dock') : page).getByRole('button', { name: 'Registrar venta', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Registrar venta' });
      await form.getByLabel('Cliente').fill('Ana Pérez');
      await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('iPhone 14');
      await form.getByRole('option', { name: /iPhone 14/ }).click();
      await form.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
      await expect(form).toBeHidden();
      const initial = await fetchSales(request, email);
      const saleId = initial.sales[0].id;
      expect(initial.sales[0].productId).toBe(product.inventoryItem.id);

      let editor = await openEditor(page, device.phone);
      if (device.phone) await editor.getByTestId('sale-trade-fold').locator('summary').click();
      await editor.getByRole('checkbox', { name: 'Tiene canje' }).check();
      await editor.getByLabel('Equipo recibido').fill('iPhone 11 64GB');
      await editor.getByLabel('Valor tomado').fill('200000');
      await editor.getByLabel('Equipo recibido').scrollIntoViewIfNeeded();
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await expect(page.locator('.toast.show')).toBeHidden();
        await editor.locator(device.phone ? '.sheet-scroll' : ':scope').evaluate((node) => { node.scrollTop = 0; });
        await page.screenshot({ path: `${shots}/issue-146-${device.name}-edit-sale-tradein.png`, animations: 'disabled' });
      }
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(editor).toBeHidden();
      const trades = await fetchTradeIns(request, email);
      expect(trades.tradeIns).toHaveLength(1);
      expect(trades.tradeIns[0]).toMatchObject({ deviceReceived: 'iPhone 11 64GB', confirmationStatus: 'CONFIRMED', differencePaid: 450000 });
      expect((await fetchSales(request, email)).sales).toHaveLength(1);

      await page.reload();
      await page.getByTestId('sidebar-tab-sales').click();
      await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
      editor = await openEditor(page, device.phone);
      await expect(editor.getByRole('checkbox', { name: 'Tiene canje' })).toBeChecked();
      await editor.getByLabel('Equipo recibido').fill('iPhone 12 128GB');
      await editor.getByLabel('Valor tomado').fill('250000');
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(editor).toBeHidden();
      expect((await fetchTradeIns(request, email)).tradeIns[0]).toMatchObject({ id: trades.tradeIns[0].id, deviceReceived: 'iPhone 12 128GB', differencePaid: 400000 });

      editor = await openEditor(page, device.phone);
      await editor.getByRole('checkbox', { name: 'Tiene canje' }).uncheck();
      await expect(editor.getByLabel('Equipo recibido')).toHaveCount(0);
      await expect(editor.getByText(/se archivará el equipo recibido/)).toBeVisible();
      await editor.getByRole('checkbox', { name: 'Tiene canje' }).scrollIntoViewIfNeeded();
      if (shots) {
        await expect(page.locator('.toast.show')).toBeHidden();
        await editor.locator(device.phone ? '.sheet-scroll' : ':scope').evaluate((node) => { node.scrollTop = 0; });
        await page.screenshot({ path: `${shots}/issue-146-${device.name}-edit-sale-remove-tradein.png`, animations: 'disabled' });
      }
      await editor.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(editor).toBeHidden();
      expect((await fetchSales(request, email)).sales).toEqual([expect.objectContaining({ id: saleId, amount: 650000, status: 'COMPLETADA' })]);
      expect((await fetchTradeIns(request, email)).tradeIns[0]).toMatchObject({ id: trades.tradeIns[0].id, confirmationStatus: 'CANCELLED' });
      expect((await fetchInventory(request, email)).inventory.some((item) => item.model === 'iPhone 12 128GB')).toBe(false);
      await page.reload();
      await page.getByTestId('sidebar-tab-sales').click();
      await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
      editor = await openEditor(page, device.phone);
      if (device.phone) await editor.getByTestId('sale-trade-fold').locator('summary').click();
      await expect(editor.getByRole('checkbox', { name: 'Tiene canje' })).not.toBeChecked();
    });
  });
}
