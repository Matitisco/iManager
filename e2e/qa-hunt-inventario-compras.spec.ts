import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { authHeaders, buildTestEmail } from './utils';
import { openDeskSection } from './navigation';

const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3257';
test.skip(!process.env.DATABASE_URL?.endsWith('/qa_hunt_inventario_compras_e2e'), 'Use the local QA hunt config');

async function call(request: APIRequestContext, email: string, method: string, route: string, data?: object) {
  const response = await request.fetch(`${api}${route}`, { method, headers: authHeaders(email), data });
  expect(response.ok(), `${method} ${route}: ${response.status()}`).toBe(true);
  return response.status() === 204 ? null : response.json();
}
async function signIn(page: Page, email: string) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient');
  });
  await page.addInitScript(email => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email })), email);
  await page.goto('/');
  await expect(page.locator('.desk-app')).toBeVisible();
}

for (const width of [1440, 390]) test.describe(`QA inventario-compras ${width}`, () => {
  test.use({ viewport: { width, height: 900 } });

  test('IMEI vendido muestra cantidad cero, y anular la venta repone una unidad', async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'hunt-imei');
    await call(request, email, 'GET', '/api/me');
    await call(request, email, 'POST', '/api/stores', { name: 'Tienda QA ficticia' });
    await call(request, email, 'PATCH', '/api/stores/current', { instagram: 'qa.ficticia', currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
    const imported = await call(request, email, 'POST', '/api/inventory/import', { rows: [{ model: 'iPhone 15 Pro', imei: '490154203237518', quantity: 1, cost: 500, price: 700, currency: 'USD' }] });
    expect(imported.imported).toBe(1);
    const { inventory } = await call(request, email, 'GET', '/api/inventory');
    const sold = await call(request, email, 'POST', '/api/operations/sales', { productId: inventory[0].id, cantidad: 1, amount: 700, currency: 'USD', exchangeRate: 1000, clientName: 'Cliente ficticio', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' });
    await signIn(page, email);
    await openDeskSection(page, 'inventory');
    await expect(page.getByTestId('inventory-total')).toHaveText('0 de 0');
    if (width === 1440) {
      await expect(page.getByTitle('Este equipo tiene IMEI y no tiene unidades en stock.')).toHaveText('0');
      await expect(page.getByRole('spinbutton', { name: /Cantidad de iPhone 15 Pro/ })).toHaveCount(0);
    } else await expect(page.getByText('Cantidad: 0 · Costo:', { exact: false })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`imei-vendido-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await call(request, email, 'POST', `/api/operations/sales/sales/${sold.sale.id}/void`, { reason: 'QA local' });
    await page.reload();
    await openDeskSection(page, 'inventory');
    await expect(page.getByTestId('inventory-total')).toHaveText('1 de 1');
    if (width === 1440) await expect(page.getByTitle('Este equipo tiene IMEI, así que cuenta como 1 unidad.')).toHaveText('1');
    else await expect(page.getByText('Cantidad: 1 · Costo:', { exact: false })).toBeVisible();
  });

  test('el total activo excluye archivados y permite consultarlos y restaurarlos', async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'hunt-archive');
    await call(request, email, 'GET', '/api/me');
    await call(request, email, 'POST', '/api/stores', { name: 'Mayorista QA ficticio' });
    await call(request, email, 'PATCH', '/api/stores/current', { instagram: 'qa.ficticia', currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
    await call(request, email, 'POST', '/api/inventory/import', { rows: [
      { model: 'iPhone 13', quantity: 5, cost: 300, price: 400, currency: 'USD' },
      { model: 'iPhone 14', quantity: 10, cost: 400, price: 500, currency: 'USD' },
    ] });
    const { inventory } = await call(request, email, 'GET', '/api/inventory');
    const archived = inventory.find((item: { model: string }) => item.model === 'iPhone 14');
    await call(request, email, 'DELETE', `/api/inventory/${archived.id}`, { reason: 'QA local' });
    await signIn(page, email);
    await openDeskSection(page, 'inventory');
    // Await supplemental archived records so the denominator cannot pass before they load.
    await page.getByRole('button', { name: 'Archivados', exact: true }).click();
    await expect(page.getByTestId('inventory-total')).toHaveText('1 archivado');
    await expect(page.getByText(/iPhone 14/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Archivados', exact: true }).click();
    await expect(page.getByText(/iPhone 14/)).toHaveCount(0);
    await expect(page.getByTestId('inventory-total')).toHaveText('5 de 5');
    await page.screenshot({ path: info.outputPath(`total-activo-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await call(request, email, 'POST', `/api/inventory/${archived.id}/restore`);
    await page.reload();
    await openDeskSection(page, 'inventory');
    await expect(page.getByTestId('inventory-total')).toHaveText('15 de 15');
  });

  for (const source of ['import', 'manual']) test(`compra ${source} conserva inversión al vender y anular`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'hunt-purchase');
    await call(request, email, 'GET', '/api/me');
    await call(request, email, 'POST', '/api/stores', { name: 'Mayorista QA ficticio' });
    await call(request, email, 'PATCH', '/api/stores/current', { instagram: 'qa.ficticia', currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
    const { supplier } = await call(request, email, 'POST', '/api/suppliers', { name: 'Proveedor ficticio QA' });
    if (source === 'import') {
      const imported = await call(request, email, 'POST', '/api/inventory/import', { supplierId: supplier.id, purchaseName: 'Lote ficticio', rows: [
        { model: 'iPhone 13', quantity: 10, cost: 300, price: 400, currency: 'USD' },
      ] });
      expect(imported).toMatchObject({ imported: 1, units: 10, errors: [] });
    } else {
      await call(request, email, 'POST', '/api/inventory', { supplierId: supplier.id, model: 'iPhone 13', cantidad: 10, cost: 300, price: 400, currency: 'USD', capacity: '128GB', color: '', condition: 'NUEVO', grade: '', batteryHealth: '', status: 'DISPONIBLE' });
    }
    await signIn(page, email);
    await openDeskSection(page, 'suppliers');
    await page.getByTestId(`supplier-${supplier.id}`).click();
    const detail = page.getByTestId('supplier-detail');
    await expect(detail).toBeVisible();
    const total = detail.locator('.sup-detail-totals');
    await expect(total).toBeVisible();
    const observed = await total.innerText();
    await page.screenshot({ path: info.outputPath(`compra-${source}-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await info.attach('inversion-observada', { body: JSON.stringify({ quantity: 10, unitCost: 300, currency: 'USD', observed, expected: 'US$ 3.000' }), contentType: 'application/json' });
    expect(observed).toBe('US$ 3.000');
    await expect(detail.getByText('10 de 10 equipos', { exact: true })).toBeVisible();
    const { inventory } = await call(request, email, 'GET', '/api/inventory');
    const sold = await call(request, email, 'POST', '/api/operations/sales', { productId: inventory[0].id, cantidad: 4, amount: 1600, currency: 'USD', exchangeRate: 1000, clientName: 'Cliente ficticio', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' });
    for (const [action, stock] of [['sale', 6], ['void', 10]] as const) {
      if (action === 'void') await call(request, email, 'POST', `/api/operations/sales/sales/${sold.sale.id}/void`, { reason: 'QA local' });
      await page.reload();
      await openDeskSection(page, 'suppliers');
      await page.getByTestId(`supplier-${supplier.id}`).click();
      await expect(total).toHaveText('US$ 3.000');
      await expect(detail.getByText(`${stock} de 10 equipos`, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`compra-${source}-${action}-${width}.png`) });
    }
  });
});
