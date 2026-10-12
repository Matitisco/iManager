import { mkdirSync } from 'node:fs';
import { devices, expect, test, type Locator } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createInventoryItemViaApi, fetchSales } from './utils';

const shots = process.env.ISSUE_286_SHOTS?.trim();
const actions = ['Cerrar', 'Cancelar operación', 'Editar', 'Compartir comprobante'];
const { defaultBrowserType: iphoneBrowser, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType: iphoneBrowser });

async function expectReachableActions(detail: Locator, width: number, height: number) {
  for (const name of actions) {
    const button = detail.locator('.sheet-foot').getByRole('button', { name, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await button.click({ trial: true });
  }
}

for (const device of [
  { name: 'desktop', phone: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile-iphone', phone: true, options: { ...iphone, viewport: { width: 390, height: 844 } } },
]) {
  test.describe(`sale detail ${device.name}`, () => {
    test.use(device.options);

    test('keeps trade-in actions visible before and after scrolling', async ({ page, request }, testInfo) => {
      const email = buildTestEmail(testInfo, `sale-detail-${device.name}`);
      await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
      await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({ json: { blue: { value_buy: 1280, value_sell: 1300 } } }));
      await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: { venta: '1300,00' } }));
      await bootstrapStoreViaApi(page, request, email, 'iManager · Ventas');
      await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 14', capacity: '128GB', price: 650000, condition: 'USADO', grade: 'A' });
      await page.reload();
      await page.getByTestId('sidebar-tab-sales').click();
      await (device.phone ? page.getByTestId('mobile-dock') : page).getByRole('button', { name: 'Registrar venta', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Registrar venta' });
      await form.getByLabel('Cliente').fill('Ana Pérez');
      await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('iPhone 14');
      await form.getByRole('option', { name: /iPhone 14/ }).click();
      if (device.phone) await form.getByTestId('sale-trade-fold').locator('summary').click();
      await form.getByRole('checkbox', { name: 'Tiene canje' }).check();
      const tradeForm = page.getByRole('dialog', { name: 'Nuevo canje' });
      await tradeForm.getByLabel('Equipo recibido').fill('iPhone 11 64GB');
      await tradeForm.getByLabel('Valor tomado').fill('200000');
      await tradeForm.getByRole('button', { name: 'Confirmar canje', exact: true }).click();
      await expect(tradeForm).toBeHidden();
      const sale = (await fetchSales(request, email)).sales[0];
      expect(sale.tradeInId).toBeTruthy();
      const code = `V-${String(sale.saleNumber).padStart(4, '0')}`;
      if (device.phone) await page.getByTestId('sales-timeline').getByRole('button').filter({ hasText: code }).first().click();
      else await page.getByRole('row').filter({ hasText: code }).click();
      const detail = page.getByRole('dialog', { name: code });
      const body = detail.locator('.sheet-scroll');
      await expect(detail.getByRole('region', { name: 'Canje como parte de pago' })).toBeVisible();
      await expect(page.locator('.toast.show')).toBeHidden();
      await detail.evaluate(async (node) => {
        await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
      });
      expect(await body.evaluate((node) => node.scrollTop)).toBe(0);
      const viewport = page.viewportSize()!;
      await expectReachableActions(detail, viewport.width, viewport.height);
      await expect(detail).toHaveCSS('overflow', 'hidden');
      await expect(body).toHaveCSS('overflow-y', 'auto');
      const footer = detail.locator('.sheet-foot');
      await expect(footer).toHaveCSS('flex-shrink', '0');
      expect(await detail.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      expect(await detail.getByRole('region').locator('.kv').evaluateAll((rows) => rows[0].getBoundingClientRect().top - rows[1].getBoundingClientRect().top)).toBe(0);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/issue-286-${device.name}.png`, animations: 'disabled' });
      }

      // A shorter viewport forces actual body scrolling while the footer stays put.
      await page.setViewportSize({ width: viewport.width, height: 500 });
      await expectReachableActions(detail, viewport.width, 500);
      const before = (await footer.boundingBox())!;
      const scroll = await body.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
        return node.scrollTop;
      });
      expect(scroll).toBeGreaterThan(0);
      const after = (await footer.boundingBox())!;
      expect(after.y).toBeCloseTo(before.y, 0);
      await expectReachableActions(detail, viewport.width, 500);
      await page.setViewportSize(viewport);
      await footer.getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Editar operación' })).toBeVisible();
    });
  });
}
