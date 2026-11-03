import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { acceptInvitationViaApi, authHeaders, bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, loginViaUi, selectDeskOption, updateStoreViaApi } from './utils';
import { openDeskSection } from './navigation';

test.skip(process.env.DASHBOARD_HUNT_LOCAL !== '1', 'Use the local-only hunt config');
const api = process.env.PLAYWRIGHT_API_BASE_URL!;
async function call(request: APIRequestContext, email: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: object) {
  const response = await request.fetch(`${api}${path}`, { method, headers: authHeaders(email), data });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true);
  return response.status() === 204 ? null : response.json();
}
async function seedSale(request: APIRequestContext, email: string) {
  await updateStoreViaApi(request, email, { currency: 'ARS', exchangeMode: 'manual', manualBuy: 900, manualSell: 1000 });
  const { inventoryItem } = await call(request, email, 'POST', '/api/inventory', {
    model: 'iPhone ficticio QA', capacity: '128GB', color: 'Negro', condition: 'NUEVO', grade: '', batteryHealth: '',
    cantidad: 20, imei: '', cost: 450, price: 650, currency: 'USD', status: 'DISPONIBLE',
  });
  const { client } = await call(request, email, 'POST', '/api/clients', { name: 'Mayorista ficticio QA' });
  const { sale } = await call(request, email, 'POST', '/api/operations/sales', {
    productId: inventoryItem.id, clientId: client.id, cantidad: 10, amount: 6500, currency: 'USD', exchangeRate: 1000,
    status: 'COMPLETADA', paymentMethod: 'EFECTIVO',
  });
  return { inventoryItem, sale };
}
async function evidence(page: Page, info: TestInfo, name: string) {
  await expect(page.locator('#boot-splash')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|\bInfinity\b/);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    if (url.hostname === 'dolarapi.com') return route.fulfill({ json: { compra: 900, venta: 1000, fechaActualizacion: new Date().toISOString() } });
    return route.abort('blockedbyclient');
  });
});

for (const width of [1440, 390]) test.describe(`QA dashboard ${width}`, () => {
  test.use({ viewport: { width, height: 900 } });

  test('cambiar moneda/cotización descarta el snapshot convertido y respeta stock mayorista', async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'hunt-money');
    const store = 'Tienda QA monetaria';
    await bootstrapStoreViaApi(page, request, email, store);
    await seedSale(request, email);
    await page.reload();
    const revenue = page.locator('.dstat').filter({ has: page.locator('.eb', { hasText: /^Ventas$/ }) });
    await expect(revenue).toContainText('$ 6,5M');
    await expect(page.locator('.dstat').filter({ hasText: /^Stock disponible/ })).toContainText('10');
    await openDeskSection(page, 'settings');
    await page.getByRole('button', { name: new RegExp(store) }).click();
    await selectDeskOption(page, page.getByTestId('store-currency'), 'USD');
    await page.getByTestId('store-manual-sell').fill('2000');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/reports/overview?**', async route => { await gate; await route.continue(); });
    try {
      await page.getByTestId('sidebar-tab-dashboard').click();
      await expect(revenue).toHaveAttribute('aria-busy', 'true');
      await expect(revenue).not.toContainText('US$ 3.250');
    } finally { release(); }
    await expect(revenue).toContainText('US$ 6.500');
    await evidence(page, info, 'dashboard-moneda');
  });

  test('STAFF ve costos y finanzas de #691 sin acceder a Reportes ni acciones sensibles', async ({ page, request, browser }, info) => {
    const owner = buildTestEmail(info, 'hunt-owner');
    const staff = buildTestEmail(info, 'hunt-staff');
    await bootstrapStoreViaApi(page, request, owner, 'Tienda QA permisos');
    const { sale } = await seedSale(request, owner);
    const invite = await createInvitationViaApi(request, owner, 'STAFF', staff);
    await acceptInvitationViaApi(request, staff, invite.token);
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const employee = await context.newPage();
    try {
      await employee.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort('blockedbyclient'));
      await loginViaUi(employee, staff);
      const revenue = employee.locator('.dstat').filter({ has: employee.locator('.eb', { hasText: /^Ventas$/ }) });
      await expect(revenue).toContainText('$ 6,5M');
      await expect(revenue).toHaveJSProperty('tagName', 'DIV');
      const inventory = await call(request, staff, 'GET', '/api/inventory');
      expect(inventory.inventory[0].cost).toBe(450);
      const denied = await request.patch(`${api}/api/sales/${sale.id}`, { headers: authHeaders(staff), data: { status: 'CANCELADA' } });
      expect(denied.status()).toBe(403);
      await evidence(employee, info, 'dashboard-staff');
      await employee.goto('/#/rep');
      await expect(employee.getByTestId('no-section-access')).toBeVisible();
    } finally { await context.close(); }
  });

  test('revocar una invitación devuelve Equipo a pendiente en una tienda recién onboardeada', async ({ page, request }, info) => {
    const email = buildTestEmail(info, 'hunt-invite');
    await loginViaUi(page, email);
    await page.getByTestId('onboarding-store-name').fill('Concordia ficticia QA');
    await page.getByTestId('onboarding-submit').click();
    await page.getByRole('button', { name: 'Saltar por ahora' }).click();
    const invitation = await createInvitationViaApi(request, email, 'STAFF');
    await call(request, email, 'DELETE', `/api/invitations/${invitation.id}`);
    await page.reload();
    await page.getByTestId('getting-started').click();
    await expect(page.getByTestId('first-step-team')).toHaveAttribute('data-done', 'false');
    await evidence(page, info, 'onboarding-invitacion-revocada');
  });
});

test('documentado: editar el costo del remanente reescribe el margen de ventas anteriores', async ({ page, request }, info) => {
  const email = buildTestEmail(info, 'hunt-history');
  await bootstrapStoreViaApi(page, request, email, 'Tienda QA histórico');
  const { inventoryItem } = await seedSale(request, email);
  const overview = async () => (await call(request, email, 'GET', '/api/reports/overview?rangeKey=all_time')).overview.summary;
  expect(await overview()).toMatchObject({ revenue: 6500000, grossProfit: 2000000 });
  await call(request, email, 'PATCH', `/api/inventory/${inventoryItem.id}`, { cost: 500, currency: 'USD' });
  const after = await overview();
  await info.attach('margen-historico', { body: JSON.stringify({ expected: 2000000, observed: after.grossProfit }), contentType: 'application/json' });
  // Known issue requiring historical cost snapshots/backfill; setup errors remain failures.
  test.fail(true, 'HUNT-04: historical sale cost is read from mutable inventory; documented without changing accounting');
  expect(after.grossProfit).toBe(2000000);
});
