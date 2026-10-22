import { openDeskSection } from './navigation';
import { mkdirSync } from 'node:fs';
import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, importSalesViaApi, fetchSales } from './utils';

const shots = process.env.ISSUE_447_SHOTS?.trim();
const tradeActions = ['Cerrar', 'Anular', 'Editar', 'Devolver', 'Compartir comprobante'];
const tradeLabels = ['Equipo recibido', 'Calidad recibida', 'Valor tomado', 'Diferencia del canje', 'Estado técnico', 'Confirmación'];
const { defaultBrowserType: iphoneBrowser, ...iphone } = devices['iPhone 13'];
test.use({ defaultBrowserType: iphoneBrowser });

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: new Date().toISOString() } }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({ json: { blue: { value_buy: 1280, value_sell: 1300 } } }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({ json: { venta: '1300,00' } }));
}

async function navigate(page: Page, tab: string, phone: boolean) {
  await openDeskSection(page, tab);
}

async function settle(detail: Locator) {
  await detail.evaluate(async (node) => {
    await Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function expectReachableActions(page: Page, detail: Locator, names: string[], width: number, height: number) {
  const footer = detail.locator('.sheet-foot');
  const menu = footer.locator('.sheet-action-menu');
  const summary = menu.locator('summary');
  if (await menu.count()) {
    await summary.click();
    await expect(menu).toHaveJSProperty('open', true);
  }
  await expect(footer.locator('.sheet-primary')).toHaveCount(1);
  for (const name of names) {
    const button = footer.getByRole('button', { name, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await button.click({ trial: true });
  }
  const grid = footer.locator('.sacts');
  await expect(grid).toHaveCSS('display', 'grid');
  await expect(grid).toHaveCSS('margin-top', '0px');
  if (await menu.count()) {
    await summary.focus();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveJSProperty('open', false);
    await expect(summary).toBeFocused();
  }
}

async function expectSharedLayout(page: Page, detail: Locator, names: string[], hasTrade: boolean) {
  await expect(detail).toHaveClass(/sale-detail-sheet/);
  await settle(detail);
  const body = detail.locator('.sheet-scroll');
  const footer = detail.locator('.sheet-foot');
  await expect(detail).toHaveCSS('overflow', 'hidden');
  await expect(body).toHaveCSS('overflow-y', 'auto');
  await expect(footer).toHaveCSS('flex-shrink', '0');
  expect(await footer.evaluate((node) => node.parentElement?.classList.contains('sale-detail-sheet'))).toBe(true);
  expect(await body.locator('.sacts').count()).toBe(0);
  expect(await detail.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  const trade = detail.getByRole('region', { name: 'Canje como parte de pago' });
  if (hasTrade) {
    await expect(trade).toHaveCount(1);
    await expect(trade.getByRole('heading', { name: 'Canje como parte de pago' })).toBeAttached();
    for (const label of tradeLabels) await expect(trade.getByText(label, { exact: true })).toBeAttached();
    expect(await trade.locator('.kv').evaluateAll((rows) => rows[0].getBoundingClientRect().top - rows[1].getBoundingClientRect().top)).toBe(0);
  } else await expect(trade).toHaveCount(0);
  const viewport = page.viewportSize()!;
  await expectReachableActions(page, detail, names, viewport.width, viewport.height);
  const before = (await footer.boundingBox())!;
  await body.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const after = (await footer.boundingBox())!;
  expect(after.y).toBeCloseTo(before.y, 0);
  await expectReachableActions(page, detail, names, viewport.width, viewport.height);
  await body.evaluate((node) => { node.scrollTop = 0; });
}

async function screenshot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await expect(page.locator('.toast.show')).toBeHidden();
  await page.screenshot({ path: `${shots}/${name}`, animations: 'disabled' });
}

for (const device of [
  { name: 'desktop-640', phone: false, options: { viewport: { width: 1536, height: 640 } } },
  { name: 'desktop-900', phone: false, options: { viewport: { width: 1440, height: 900 } } },
  { name: 'mobile-iphone', phone: true, options: { ...iphone } },
  { name: 'mobile-320', phone: true, options: { viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true } },
]) {
  test.describe(`sale detail ${device.name}`, () => {
    test.use(device.options);

    test('shares grouped trade data and fixed actions across Reportes, Ventas, Dashboard and notifications', async ({ page, request }, testInfo) => {
      test.setTimeout(120_000);
      const email = buildTestEmail(testInfo, `sale-detail-${device.name}`);
      await mockDollar(page);
      await bootstrapStoreViaApi(page, request, email, 'iManager · Ventas');
      const buyer = 'Ana María Pérez · Cuenta corriente del local';
      const { client } = await createClientViaApi(request, email, { name: buyer });
      await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 14 Pro Max · Violeta profundo', capacity: '256GB', price: 650000, condition: 'USADO', grade: 'A' });
      await page.reload();
      await navigate(page, 'clients', device.phone);
      await page.getByTestId(`client-row-${client.id}`).click();
      await page.getByRole('dialog', { name: buyer }).getByRole('button', { name: 'Nueva venta' }).click();
      const form = page.getByRole('dialog', { name: 'Registrar venta' });
      await expect(form.getByLabel('Cliente')).toHaveValue(buyer);
      await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('iPhone 14');
      await form.getByRole('option', { name: /iPhone 14/ }).click();
      await form.getByRole('checkbox', { name: 'Tiene canje' }).check();
      const tradeForm = page.getByRole('dialog', { name: 'Nuevo canje' });
      await tradeForm.getByLabel('Equipo recibido').fill('iPhone 11 Pro Max 256GB · Verde medianoche · Equipo recibido con caja y accesorios');
      await tradeForm.getByLabel('Valor tomado').fill('200000');
      await tradeForm.getByRole('button', { name: 'Confirmar canje', exact: true }).click();
      await expect(tradeForm).toBeHidden();
      const sale = (await fetchSales(request, email)).sales[0];
      expect(sale.tradeInId).toBeTruthy();
      expect(sale.clientId).toBe(client.id);
      const code = `V-${String(sale.saleNumber).padStart(4, '0')}`;
      await expect(page.locator('.toast.show')).toBeHidden();

      for (const path of ['reports', 'sales', 'dashboard', 'notifications']) {
        await navigate(page, path, device.phone);
        if (path === 'reports') await page.locator('.gtk').filter({ hasText: code }).click();
        else if (path === 'sales') {
          if (device.phone) await page.getByTestId('sales-timeline').getByRole('button').filter({ hasText: code }).first().click();
          else await page.getByRole('row').filter({ hasText: code }).click();
        } else if (path === 'dashboard') {
          const recent = page.getByTestId('dashboard-sales');
          await recent.getByRole('button').filter({ hasText: code }).first().click();
        } else await page.getByRole('button', { name: /Venta registrada/ }).click();
        const detail = page.getByRole('dialog', { name: code });
        await expectSharedLayout(page, detail, tradeActions, true);
        if (path === 'reports') {
          // Capture the whole trade block with the fixed actions after scrolling.
          await detail.locator('.sheet-scroll').evaluate((node) => { node.scrollTop = node.scrollHeight; });
          if (device.name === 'desktop-640') await screenshot(page, 'issue-447-desktop-1536-canje.png');
          if (device.name === 'mobile-iphone') await screenshot(page, 'issue-447-mobile-390-canje.png');
          if (device.name === 'mobile-320') await screenshot(page, 'issue-447-mobile-320-canje.png');
          const viewport = page.viewportSize()!;
          await page.setViewportSize({ width: viewport.width, height: 500 });
          await expectSharedLayout(page, detail, tradeActions, true);
          expect(await detail.locator('.sheet-scroll').evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(0);
          await page.setViewportSize(viewport);
        }
        await detail.locator('.sheet-foot').getByRole('button', { name: 'Cerrar', exact: true }).click();
        await expect(detail).toBeHidden();
      }
    });

    for (const pending of [false, true]) {
      test(`keeps ${pending ? 2 : 4} actions evenly spaced for a sale without trade-in from Reportes`, async ({ page, request }, testInfo) => {
        const email = buildTestEmail(testInfo, `sale-no-trade-${device.name}`);
        await mockDollar(page);
        await bootstrapStoreViaApi(page, request, email, 'iManager · Reportes');
        const date = new Date().toLocaleDateString('es-AR');
        const imported = await importSalesViaApi(request, email, [{
          date, clientName: 'Juan Domínguez', device: 'iPhone 16 Pro 256GB', amount: '8000000',
          status: pending ? 'PENDIENTE' : 'COMPLETADA',
        }]);
        expect(imported).toEqual(expect.objectContaining({ imported: 1, errors: [] }));
        const sale = (await fetchSales(request, email)).sales[0];
        expect(sale.integratedOperation).toBe(false);
        expect(sale.tradeInId).toBeNull();
        const code = `V-${String(sale.saleNumber).padStart(4, '0')}`;
        await page.reload();
        await navigate(page, 'reports', device.phone);
        await page.locator('.gtk').filter({ hasText: code }).click();
        const detail = page.getByRole('dialog', { name: code });
      const names = pending ? ['Cerrar', 'Anular', 'Marcar cobrada'] : ['Cerrar', 'Editar', 'Devolver', 'Compartir comprobante'];
        await expectSharedLayout(page, detail, names, false);
        if (!pending) {
          if (device.name === 'desktop-640') await screenshot(page, 'issue-447-desktop-1536-sin-canje.png');
          if (device.name === 'mobile-iphone') await screenshot(page, 'issue-447-mobile-390-sin-canje.png');
          if (device.name === 'mobile-320') await screenshot(page, 'issue-447-mobile-320-sin-canje.png');
          await detail.locator('.sheet-foot .sheet-action-menu summary').click();
          await detail.locator('.sheet-foot').getByRole('button', { name: 'Editar', exact: true }).click();
          await expect(page.getByRole('dialog', { name: 'Editar operación' })).toBeVisible();
        } else {
          await detail.locator('.sheet-foot').getByRole('button', { name: 'Marcar cobrada' }).click();
          await expect(detail).toBeHidden();
          expect((await fetchSales(request, email)).sales[0].status).toBe('COMPLETADA');
        }
      });
    }
  });
}
