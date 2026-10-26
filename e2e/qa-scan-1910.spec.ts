import { expect, test } from '@playwright/test';
import { authHeaders, buildTestEmail, loginViaUi } from './utils';
import { bootStore, installFakeCamera, inviteStaffWithoutInventory, registerScanQa } from './qa-scan-1910';

const API = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

test.use({ browserName: 'chromium', viewport: { width: 1440, height: 900 } });

registerScanQa(1440);

test('permisos por tienda y por sección', async ({ page, request, browser }, testInfo) => {
  test.setTimeout(90_000);
  const owner = await bootStore(page, request, testInfo, 'permisos');
  const staffEmail = buildTestEmail(testInfo, 'empleado');
  await inviteStaffWithoutInventory(request, owner, staffEmail);
  const denied = await request.post(`${API}/api/inventory/batch`, {
    headers: { ...authHeaders(staffEmail), 'Content-Type': 'application/json' },
    data: { items: [{ imei: '352098117744522', model: 'iPhone 13', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 1, price: 2, status: 'DISPONIBLE' }] },
  });
  expect(denied.status()).toBe(403);

  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_APP_BASE_URL?.trim() || 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
  });
  const staff = await context.newPage();
  await installFakeCamera(staff);
  await loginViaUi(staff, staffEmail);
  await expect(staff.locator('.desk-app')).toBeVisible();
  await expect(staff.getByTestId('sidebar-tab-inventory')).toHaveCount(0);
  await expect(staff.getByTestId('sidebar-tab-stockCount')).toHaveCount(0);
  await staff.goto('/#/stock/equipos');
  await expect(staff.getByTestId('no-section-access')).toContainText('No tenés acceso');
  await staff.goto('/#/comercial/ventas');
  await expect(staff.getByRole('heading', { name: 'Ventas', level: 1 })).toBeVisible();
  await staff.getByRole('button', { name: 'Registrar venta' }).click();
  await expect(staff.getByRole('dialog', { name: 'Registrar venta' }).getByRole('button', { name: 'Escanear con la cámara' })).toBeVisible();
  await context.close();
});

test('humo de navegación, seguimientos, stock, devoluciones, proveedores y reporte', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  await bootStore(page, request, testInfo, 'humo');
  await expect(page.getByTestId('nav-group-comercial')).toBeVisible();
  await expect(page.getByTestId('nav-group-stock')).toBeVisible();
  await expect(page.getByTestId('nav-group-atencion')).toBeVisible();
  await expect(page.getByTestId('nav-group-finanzas')).toBeVisible();
  await expect(page.locator('aside').getByTestId('sidebar-tab-followups')).toHaveCount(0);
  await expect(page.locator('aside').getByTestId('sidebar-tab-returns')).toBeHidden();
  await expect(page.locator('aside').getByTestId('sidebar-tab-expenses')).toHaveCount(0);
  await expect(page.locator('aside').getByTestId('sidebar-tab-suppliers')).toBeHidden();

  const routes: Array<[string, string, string]> = [
    ['#/inv', '#/stock/equipos', 'Inventario'],
    ['#/control', '#/stock/control', 'Control de stock'],
    ['#/proveedores', '#/finanzas/proveedores', 'Proveedores'],
    ['#/stock/proveedores', '#/finanzas/proveedores', 'Proveedores'],
    ['#/ven', '#/comercial/ventas', 'Ventas'],
    ['#/canjes', '#/comercial/canjes', 'Canjes'],
    ['#/devoluciones', '#/comercial/devoluciones', 'Devoluciones'],
    ['#/seguimientos', '#/atencion/clientes', 'Clientes'],
    ['#/gastos', '#/dashboard', '¿Qué hay para hoy?'],
    ['#/rep', '#/analisis/reportes', 'Reportes'],
  ];
  for (const [legacy, canonical, heading] of routes) {
    await page.goto(`/${legacy}`);
    await expect(page).toHaveURL(new RegExp(`${canonical.replaceAll('/', '\\/')}$`));
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Secciones del grupo' })).toHaveCount(0);
    if (heading !== '¿Qué hay para hoy?') await expect(page.locator('aside button[aria-expanded="true"]')).toHaveCount(1);
  }

  await expect(page.getByTestId('group-tab-followups')).toHaveCount(0);
  await page.goto('/#/cuenta/configuracion');
  await page.getByRole('button', { name: /Reporte automático/ }).click();
  await expect(page).toHaveURL(/#\/analisis\/resumen-periodico\?view=mail$/);
  await expect(page.getByRole('heading', { name: 'Resumen periódico', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Envío por mail', exact: true })).toHaveAttribute('aria-selected', 'true');
  const report = page.getByRole('region', { name: 'Reporte por mail', exact: true });
  await expect(report).toBeVisible();
  await expect(report.getByRole('textbox', { name: 'Mail destinatario', exact: true })).toBeEditable();
  await page.screenshot({ path: 'docs/pr-shots/qa-1910-reporte-1440.png', animations: 'disabled' });
});
