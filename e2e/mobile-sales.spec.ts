import { expect, test, type Page } from '@playwright/test';
import { bootstrapStoreViaApi, buildTestEmail, fetchClients, fetchSales } from './utils';

const SHOTS = process.env.MOBILE_SALES_SHOTS?.trim();

async function mockDollar(page: Page) {
  await page.route('https://dolarapi.com/**', (route) => route.fulfill({
    json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-08T21:40:00-03:00' },
  }));
  await page.route('https://api.bluelytics.com.ar/**', (route) => route.fulfill({
    json: { blue: { value_buy: 1270, value_sell: 1290 }, last_update: '2026-10-08T21:10:00-03:00' },
  }));
  await page.route('https://mercados.ambito.com/**', (route) => route.fulfill({
    json: { venta: '1300,00', valor_cierre_ant: '1290,00' },
  }));
}

async function settleMotion(page: Page, selector: string) {
  await page.locator(selector).first().evaluate(async (node) => {
    const animations = node.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

async function expectFits(page: Page) {
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - width;
    const outside: string[] = [];
    const roots = ['.mhead', '.mtab', '.stage', '.mdock', '.ov', '.sheet', '.ctx', '.dialog'].flatMap((selector) => [...document.querySelectorAll(selector)]);
    for (const root of roots) {
      const nodes = [root, ...root.querySelectorAll('*')];
      for (const node of nodes) {
        if (!(node instanceof Element) || node.closest('.toast')) continue;
        if (node.closest('.wchips, .gfilters, .dkanban, .sale-pills') && !node.matches('.wchips, .gfilters, .dkanban, .sale-pills')) continue;
        const box = node.getBoundingClientRect();
        if (box.width < 1 && box.height < 1) continue;
        if (box.left < -1 || box.right > width + 1) {
          const label = node.getAttribute('data-testid') || (typeof node.className === 'string' ? node.className : node.tagName);
          outside.push(`${String(label).slice(0, 70)} [${Math.round(box.left)}…${Math.round(box.right)}]`);
          if (outside.length >= 8) return { extra, outside };
        }
      }
    }
    return { extra, outside };
  });
  expect(report.outside).toEqual([]);
  expect(report.extra).toBeLessThanOrEqual(1);
}

test.describe('desktop sales stays put', () => {
  test('keeps the table, the inline actions and the old empty copy', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'sales-desk');
    await mockDollar(page);
    await bootstrapStoreViaApi(page, request, email, `Ventas desk ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-sales').click();
    await expect(page.locator('.side')).toBeVisible();
    await expect(page.getByTestId('mobile-dock')).toHaveCount(0);
    await expect(page.getByTestId('sales-hero')).toHaveCount(0);
    await expect(page.getByTestId('sales-empty')).toHaveCount(0);
    await expect(page.getByTestId('sale-trade-fold')).toHaveCount(0);
    await expect(page.getByText('No encontré ventas.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Venta/ })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar cliente, equipo o número')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar venta' })).toBeVisible();
  });
});

test.describe('sales on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('lists sales, registers one with trade-in and keeps detail actions inside the screen', async ({ page, request }, testInfo) => {
    const email = buildTestEmail(testInfo, 'sales-phone');
    const clientName = `Cliente cel ${testInfo.parallelIndex}`;
    await mockDollar(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => undefined },
      });
    });
    await bootstrapStoreViaApi(page, request, email, `Ventas ${testInfo.parallelIndex}`);
    await page.getByTestId('sidebar-tab-sales').click();
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible();
    await expect(page.getByTestId('page-back')).toHaveCount(0);
    await expect(page.getByTestId('sales-hero')).toContainText('Facturación total');
    await expect(page.getByTestId('sales-hero')).toContainText('Ticket promedio');
    await expect(page.getByTestId('sales-hero')).toContainText('Margen bruto est.');
    await expect(page.getByTestId('sales-empty')).toContainText('No hay ventas');
    await expect(page.getByText('0 resultados')).toBeVisible();
    await expect(page.getByTestId('sales-period')).toContainText('Mes');
    await expect(page.getByTestId('sales-status')).toContainText('Estado');
    await settleMotion(page, '.enter-f');
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' })).toBeVisible();
    await expect(page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' })).toBeVisible();
    const dockBox = await page.getByTestId('mobile-dock').boundingBox();
    const tabBox = await page.getByTestId('mobile-tab-bar').boundingBox();
    expect(dockBox && tabBox && dockBox.y + dockBox.height <= tabBox.y + 1).toBeTruthy();
    await expect(page.getByPlaceholder('Buscar cliente, equipo o número')).toHaveCount(0);
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-390-empty.png` });

    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByPlaceholder('Buscar cliente, equipo o número')).toBeVisible();
    await page.getByRole('button', { name: 'Buscar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Importar' }).click();
    const importer = page.getByRole('dialog', { name: 'Importar ventas' });
    await expect(importer.locator('.sheet-grab')).toBeVisible();
    await expect(importer.locator('.sheet-foot').getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    await importer.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' }).click();
    const form = page.getByRole('dialog', { name: 'Registrar venta' });
    await expect(form.locator('.sheet-grab')).toBeVisible();
    await expect(form.locator('.sheet-foot').getByRole('button', { name: 'Confirmar venta' })).toBeVisible();
    await expect(form.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' })).toBeVisible();
    await expect(form.getByText(/ARS/)).toBeVisible();
    await expect(form.getByRole('button', { name: 'Transferencia' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Efectivo' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Cobrado' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Pendiente' })).toBeVisible();
    await form.getByLabel('Cliente').fill(clientName);
    await expect(form.getByText(/Se crea un cliente nuevo al guardar/)).toBeVisible();
    const fold = form.getByTestId('sale-trade-fold');
    await expect(fold.getByRole('checkbox', { name: 'Tiene canje' })).toBeHidden();
    await fold.locator('summary').click();
    await expect(fold.getByRole('checkbox', { name: 'Tiene canje' })).toBeVisible();
    await fold.getByRole('checkbox', { name: 'Tiene canje' }).check();
    const tradeForm = page.getByRole('dialog', { name: 'Nuevo canje' });
    await expect(tradeForm.getByLabel('Equipo recibido')).toBeVisible();
    await expect(tradeForm.getByLabel('Valor tomado')).toBeVisible();
    await expect(tradeForm.locator('.sheet-foot').getByRole('button', { name: 'Guardar pendiente' })).toBeVisible();
    await tradeForm.getByLabel('Equipo recibido').scrollIntoViewIfNeeded();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-390-new.png` });
    await tradeForm.getByTestId('sale-trade-fold').getByRole('checkbox', { name: 'Tiene canje' }).uncheck();
    const ready = page.getByRole('dialog', { name: 'Registrar venta' });
    await ready.getByRole('combobox', { name: 'Equipo' }).fill('iPhone 13 128GB');
    await ready.getByLabel('Precio completo de salida').fill('650000');
    await ready.getByRole('button', { name: 'Efectivo' }).click();
    await ready.locator('.sheet-foot').getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(form).toBeHidden();

    const created = await fetchSales(request, email);
    expect(created.sales).toHaveLength(1);
    expect(created.sales[0]?.status).toBe('COMPLETADA');
    const clients = await fetchClients(request, email);
    expect(clients.clients.some((client) => client.name === clientName)).toBeTruthy();

    const card = page.getByText(clientName).locator('xpath=ancestor::button[1]');
    await expect(card.getByText(/#V-/)).toBeVisible();
    await expect(card.getByText('iPhone 13 128GB')).toBeVisible();
    await expect(card.getByText('Efectivo')).toBeVisible();
    await expect(card.getByText('$ 650.000')).toBeVisible();
    await expect(card.getByText('Completada')).toBeVisible();
    await expect(page.getByTestId('row-menu')).toBeVisible();
    await expect(page.getByTestId('sales-hero')).toContainText('$ 650.000');
    await expect(page.locator('.toast.show')).toBeHidden();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-390-list.png`, fullPage: true });

    await page.getByTestId('sales-status').getByRole('button', { name: 'Estado' }).click();
    await page.getByRole('button', { name: 'Pendiente' }).click();
    await expect(page.getByText('No hay ventas con ese filtro.')).toBeVisible();
    await page.getByTestId('sales-status').getByRole('button', { name: 'Pendiente' }).click();
    await page.getByRole('button', { name: 'Todos' }).click();
    await expect(page.getByText(clientName)).toBeVisible();

    await card.click();
    const detail = page.getByRole('dialog', { name: /V-/ });
    await expect(detail.getByText(clientName)).toBeVisible();
    await expect(detail.getByText('Efectivo')).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Compartir comprobante' })).toBeVisible();
    await expect(detail.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-390-detail.png` });

    await detail.locator('.sheet-foot').getByRole('button', { name: 'Editar' }).click();
    const editor = page.getByRole('dialog', { name: 'Editar operación' });
    await expect(editor.getByLabel('Cliente')).toHaveValue(clientName);
    await expect(editor.locator('.sheet-foot').getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
    await expect(editor.getByTestId('sale-trade-fold')).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-390-edit.png` });
    await editor.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await card.click();
    const again = page.getByRole('dialog', { name: /V-/ });
    await again.locator('.sheet-foot').getByRole('button', { name: 'Compartir comprobante' }).click();
    await expect(page.getByText('Comprobante copiado')).toBeVisible();
    await expect(page.locator('.toast.show')).toBeHidden();
    await again.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' }).click();
    const confirm = page.getByRole('dialog', { name: 'Cancelar operación' });
    await expect(confirm).toBeVisible();
    await settleMotion(page, '.dialog');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-390-cancel.png` });
    await confirm.getByRole('button', { name: 'Volver' }).click();
    await expect(again.locator('.sheet-foot').getByRole('button', { name: 'Cancelar operación' })).toBeVisible();
    await again.locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await page.getByTestId('row-menu').click();
    await expect(page.locator('.ctx').getByRole('button', { name: 'Editar' })).toBeVisible();
    await expectFits(page);
    await page.locator('.ctx').getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog', { name: 'Editar operación' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Editar operación' }).locator('.sheet-foot').getByRole('button', { name: 'Cerrar' }).click();

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator('.toast.show')).toBeHidden();
    await expect(page.getByTestId('mobile-dock')).toBeVisible();
    await expect(page.getByText(clientName)).toBeVisible();
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-360-list.png`, fullPage: true });

    await page.getByTestId('mobile-dock').getByRole('button', { name: 'Registrar venta' }).click();
    await expect(page.getByRole('dialog', { name: 'Registrar venta' })).toBeVisible();
    await settleMotion(page, '.sheet');
    await expectFits(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sales-360-new.png` });
  });
});
