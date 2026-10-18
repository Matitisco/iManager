import { mkdirSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchClients, fetchInventory, fetchSales, fetchTradeIns } from './utils';

const shots = process.env.ISSUE_303_SHOTS?.trim();
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType });
for (const device of [
  { name: 'desktop', mobile: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile-iphone', mobile: true, options: { ...iphone, viewport: { width: 390, height: 844 } } },
]) {
  test.describe(`bulk actions ${device.name}`, () => {
    test.use(device.options);
    test('selects filtered rows across pages, confirms and persists deletion', async ({ page, request }, testInfo) => {
      const email = buildTestEmail(testInfo, `bulk-${device.name}`);
      await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
      await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({ json: { blue: { value_buy: 1280, value_sell: 1300 } } }));
      await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: { venta: '1300,00' } }));
      await bootstrapStoreViaApi(page, request, email, 'iManager · Equipos');
      for (let index = 0; index < 10; index++) await createInventoryItemViaApi(request, email, {
        imei: `3591234567890${String(index).padStart(2, '0')}`,
        model: `iPhone ${15 - (index % 4)}`, price: 950000 - index * 25000, color: index % 2 ? 'Azul' : 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%',
      });
      await page.reload(); await page.getByTestId('sidebar-tab-inventory').click();
      const checks = page.getByRole('checkbox', { name: /^Seleccionar iPhone/ });
      if (device.mobile) {
        const card = page.locator('.phone-row').first();
        await expect(checks).toHaveCount(0);
        if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/issue-303-mobile-list.png`, animations: 'disabled' }); }
        // Real touch pointer events in WebKit trigger the same hold timer as an iPhone.
        await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 150, clientY: 300, button: 0 });
        await expect(page.locator('.ctx')).toBeVisible();
        await expect(checks).toHaveCount(0);
        await card.dispatchEvent('pointerup', { pointerType: 'touch' });
        await expect(page.locator('.ctx').getByRole('button', { name: 'Editar', exact: true })).toBeVisible();
        await expect(page.locator('.ctx').getByRole('button', { name: 'Eliminar', exact: true })).toBeVisible();
        if (shots) await page.screenshot({ path: `${shots}/issue-303-mobile-longpress-sheet.png`, animations: 'disabled' });
        await page.getByRole('button', { name: 'Seleccionar varios', exact: true }).click();
        await expect(checks.first()).toBeChecked();
        await checks.nth(1).check(); await checks.nth(2).check();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      } else {
        await checks.nth(0).check(); await checks.nth(1).check(); await checks.nth(2).check();
      }
      await page.locator('.stage').evaluate((node) => { node.scrollTop = 0; });
      const bar = page.getByTestId('bulk-action-bar');
      await expect(bar).toContainText('3 seleccionados');
      await expect(bar.getByRole('button', { name: 'Eliminar selección' })).toBeInViewport({ ratio: 1 });
      if (device.mobile) {
        await expect(bar).toHaveCSS('position', 'fixed');
        const box = (await bar.boundingBox())!; expect(box.y + box.height).toBeCloseTo(page.viewportSize()!.height, 0);
        for (const button of await bar.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await expect(page.getByTestId('mobile-tab-bar')).toBeHidden();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/issue-303-${device.mobile ? 'mobile-selection' : 'desktop'}.png`, animations: 'disabled' }); }
      await bar.getByRole('button', { name: 'Eliminar selección' }).click();
      const dialog = page.getByRole('dialog', { name: 'Eliminar selección: 3 registros' }); await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('no se puede deshacer');
      await expect(page.locator('.toast.show')).toBeHidden();
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      expect((await fetchInventory(request, email)).inventory).toHaveLength(10);
      await page.getByRole('checkbox', { name: 'Seleccionar todos los filtrados (10)' }).check();
      await expect(bar).toContainText('10 seleccionados');
      await page.getByRole('button', { name: 'Página 2', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: /^Seleccionar iPhone/ }).first()).toBeChecked();
      await bar.getByRole('button', { name: 'Eliminar selección' }).click();
      await page.getByRole('dialog', { name: 'Eliminar selección: 10 registros' }).getByRole('button', { name: 'Eliminar selección', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      if (device.mobile) {
        await expect(bar).toContainText('0 seleccionados');
        await bar.getByRole('button', { name: 'Listo', exact: true }).click();
      }
      await expect(bar).toHaveCount(0);
      expect((await fetchInventory(request, email)).inventory).toHaveLength(0);
      await page.reload(); await page.getByTestId('sidebar-tab-inventory').click();
      await expect(page.getByTestId('inventory-empty')).toBeVisible();
    });
  });
}

test('bulk cancels sales/trades with existing operation rules and deletes unrelated clients', async ({ page, request }, testInfo) => {
  const email = buildTestEmail(testInfo, 'bulk-operations');
  await bootstrapStoreViaApi(page, request, email, 'Operaciones masivas');
  await createClientViaApi(request, email, { name: 'Cliente independiente', dni: '12345678' });
  await page.reload(); await expect(page.getByTestId('sidebar-tab-sales')).toBeVisible();
  for (let index = 0; index < 2; index++) {
    await page.getByTestId('sidebar-tab-sales').click();
    await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Registrar venta' });
    await form.getByLabel('Cliente').fill(`Cliente venta ${index}`);
    await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill(`Equipo venta ${index}`);
    await form.getByLabel('Precio completo de salida').fill('1200');
    await form.getByRole('button', { name: 'Confirmar venta', exact: true }).click(); await expect(form).toBeHidden();
  }
  await page.getByRole('checkbox', { name: 'Seleccionar todos los filtrados (2)' }).check();
  await page.getByRole('button', { name: 'Cancelar ventas', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar ventas', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await fetchSales(request, email)).sales.every((sale) => sale.status === 'CANCELADA')).toBe(true);
  for (let index = 0; index < 2; index++) {
    await page.getByTestId('sidebar-tab-tradeins').click(); await page.getByRole('button', { name: 'Nuevo canje', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Nuevo canje' });
    await form.getByLabel('Cliente').fill(`Cliente canje ${index}`);
    await form.getByLabel('Equipo recibido').fill(`Recibido ${index}`); await form.getByLabel('Valor tomado').fill('400');
    await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill(`Entregado ${index}`); await form.getByLabel('Precio completo de salida').fill('1000');
    await form.getByRole('button', { name: 'Confirmar canje', exact: true }).click(); await expect(form).toBeHidden();
  }
  await page.getByRole('checkbox', { name: 'Seleccionar todos los filtrados (2)' }).check();
  await page.getByRole('button', { name: 'Cancelar canjes', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar canjes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await fetchTradeIns(request, email)).tradeIns.every((trade) => trade.confirmationStatus === 'CANCELLED')).toBe(true);
  expect((await fetchInventory(request, email)).inventory.filter((item) => item.model.startsWith('Recibido'))).toHaveLength(0);
  await page.getByTestId('sidebar-tab-clients').click();
  await page.getByRole('checkbox', { name: 'Seleccionar Cliente independiente', exact: true }).check();
  await page.getByRole('button', { name: 'Eliminar selección', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar selección', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await fetchClients(request, email)).clients.some((client) => client.name === 'Cliente independiente')).toBe(false);
});
