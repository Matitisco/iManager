import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { adminEmail, api, call, dayAgo, seedWholesale, signIn, today } from './fixtures/juan-nov2';
import { authHeaders } from './utils';
import { openDeskSection } from './navigation';
import { sheetAction } from './sheet-actions';

const evidence = process.env.JUAN_QA_ARTIFACTS || path.resolve('test-results/juan-nov2');
test.skip(process.env.JUAN_QA_LOCAL !== '1', 'Run with e2e/juan-nov2.config.ts and a disposable local database');
function stat(page: Page, label: string) {
  return page.locator('.dstat').filter({ has: page.locator('.eb', { hasText: new RegExp(`^${label}$`) }) }).locator('.big');
}
async function shot(page: Page, info: TestInfo, name: string) {
  const path = `${evidence}/${name}-${info.project.name || page.viewportSize()!.width}.png`;
  await mkdir(evidence, { recursive: true });
  await expect(page.locator('#boot-splash')).toHaveCount(0);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
  expect.soft(await page.evaluate(() => document.documentElement.scrollWidth), 'No page overflow').toBeLessThanOrEqual(page.viewportSize()!.width);
  expect.soft(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|\bInfinity\b/);
}
function amount(text: string) {
  const match = text.match(/US\$\s*(-?[\d.]+(?:,\d+)?)/);
  expect(match, `Expected an exact USD amount: ${text}`).toBeTruthy();
  return Number(match![1].replaceAll('.', '').replace(',', '.'));
}

for (const width of [1440, 390]) test.describe(`QA mayorista ${width}`, () => {
  test.use({ viewport: { width, height: 900 } });
  let fixture: Awaited<ReturnType<typeof seedWholesale>>;
  test.beforeAll(async ({ request }) => {
    fixture = await seedWholesale(request, width);
    await mkdir(evidence, { recursive: true });
    await writeFile(`${evidence}/fixture-${width}.json`, JSON.stringify(fixture, null, 2));
  });
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    const responses: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !/ERR_BLOCKED_BY_CLIENT|ERR_FAILED|Failed to load resource/.test(message.text())) errors.push(message.text());
    });
    page.on('response', response => {
      if (new URL(response.url()).hostname === '127.0.0.1' && response.status() >= 400) responses.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
    });
    // All business requests reach the real local API. External browser traffic is blocked.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient');
    });
    (page as Page & { qaErrors: string[]; qaResponses: string[] }).qaErrors = errors;
    (page as Page & { qaResponses: string[] }).qaResponses = responses;
  });
  test.afterEach(async ({ page }, info) => {
    const monitored = page as Page & { qaErrors: string[]; qaResponses: string[] };
    await info.attach('browser-errors', { body: JSON.stringify({ errors: monitored.qaErrors, http: monitored.qaResponses }, null, 2), contentType: 'application/json' });
    expect.soft(monitored.qaErrors, 'Uncaught browser errors').toEqual([]);
    // Explicitly forbidden requests in access-control tests are asserted separately.
    const unexpected = monitored.qaResponses.filter(response => !(info.title.includes('permisos') && /^403 GET \/(?:api\/me\/admin|admin\/)/.test(response)));
    expect.soft(unexpected, 'Unexpected local HTTP errors').toEqual([]);
    if (info.status !== info.expectedStatus) await shot(page, info, `failure-${info.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 70)}`);
  });

  test('Dashboard: todos los períodos con importes y unidades reales', async ({ page, request }, info) => {
    await signIn(page, fixture.email);
    await expect(page.locator('.dashboard-screen .dstats')).toBeVisible();
    for (const preset of ['Hoy', 'Últimos 7 días', 'Este mes', 'Mes anterior', 'Total']) {
      if (width === 1440) await page.getByRole('button', { name: /^Elegir período,/ }).click();
      else await page.locator('.dashboard-month-nav button').nth(1).click();
      const dialog = page.getByRole('dialog', { name: 'Elegir período' });
      await dialog.getByRole('button', { name: preset, exact: true }).click();
      const response = page.waitForResponse(response => response.url().includes('/api/reports/overview') && response.ok());
      await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
      const overview = (await (await response).json()).overview;
      expect(overview.summary.revenue).toBeGreaterThan(0);
      expect(overview.summary.grossProfit).toBeGreaterThan(0);
      expect(overview.summary.unitsSold).toBeGreaterThan(0);
      await expect(stat(page, 'Equipos vendidos')).toHaveText(String(overview.summary.unitsSold));
      await expect(stat(page, 'Ventas')).not.toHaveText(/^(?:US\$\s*)?0(?:[.,]0+)?$/);
      await shot(page, info, `dashboard-${preset.replaceAll(' ', '-')}`);
    }
    const query = new URLSearchParams({ rangeKey: 'custom', startDate: `${today}T00:00:00.000-03:00`, endDate: `${today}T23:59:59.999-03:00` });
    const overview = (await call(request, fixture.email, 'GET', `/api/reports/overview?${query}`)).overview;
    expect(overview.summary.revenue).toBe(3200);
    expect(overview.summary.grossProfit).toBe(1280);
    expect(overview.summary.unitsSold).toBe(32);
  });

  test('Ficha cliente: siete compras, veintidós garantías y lista completa', async ({ page }, info) => {
    await signIn(page, fixture.email);
    await openDeskSection(page, 'clients');
    await page.getByTestId(`client-row-${fixture.client.id}`).click();
    const stats = page.getByTestId('client-purchase-stats');
    await expect(stats).toBeVisible();
    await expect(stats.locator('.dstat').filter({ hasText: 'Compras' }).locator('.big')).toHaveText('7');
    await expect(stats.locator('.dstat').filter({ hasText: 'Garantías' }).locator('.big')).toHaveText('22 vigentes');
    await expect(stats.locator('.cl-spending-total .big')).toContainText('2.200');
    await shot(page, info, 'cliente-siete-compras');
    await page.getByTestId('purchases-more').click();
    const purchases = page.getByRole('dialog').last();
    await expect(purchases.locator('[data-testid^="purchase-sale-"]')).toHaveCount(7);
    await expect(purchases.locator('.sale-quantity')).toHaveCount(7);
    await shot(page, info, 'cliente-lista-completa');
  });

  test('Dashboard: ventas a cuenta PENDIENTE cuentan en todos los períodos', async ({ page, request }, info) => {
    const email = `qa-pending-${width}-${Date.now()}@imanager.test`;
    await call(request, email, 'GET', '/api/me');
    await call(request, email, 'POST', '/api/stores', { name: 'Mayorista a cuenta ficticio' });
    await call(request, email, 'PATCH', '/api/stores/current', { instagram: 'pendiente.ficticio', currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
    const { inventoryItem } = await call(request, email, 'POST', '/api/inventory', { model: 'Equipo a cuenta QA', capacity: '64GB', color: 'Negro', condition: 'NUEVO', grade: 'A+', batteryHealth: '100%', cost: 60, price: 100, cantidad: 100, currency: 'USD', status: 'DISPONIBLE' });
    for (const [days, cantidad] of [[0, 2], [1, 3], [5, 5], [32, 2]]) {
      await call(request, email, 'POST', '/api/operations/sales', { date: dayAgo(days), clientName: 'Cliente a cuenta ficticio', productId: inventoryItem.id, cantidad, amount: cantidad * 100, unitPrice: 100, currency: 'USD', status: 'PENDIENTE' });
    }
    await signIn(page, email);
    await expect(page.locator('.dashboard-kpi-value').first()).toContainText('US$');
    for (const preset of ['Hoy', 'Últimos 7 días', 'Este mes', 'Mes anterior', 'Total']) {
      if (width === 1440) await page.getByRole('button', { name: /^Elegir período,/ }).click();
      else await page.locator('.dashboard-month-nav button').nth(1).click();
      const dialog = page.getByRole('dialog', { name: 'Elegir período' });
      await dialog.getByRole('button', { name: preset, exact: true }).click();
      const pending = page.waitForResponse(response => response.url().includes('/api/reports/overview') && response.ok());
      await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click();
      const response = await pending;
      const query = new URL(response.url()).searchParams;
      const start = query.get('startDate')?.slice(0, 10) ?? '0000-01-01';
      const end = query.get('endDate')?.slice(0, 10) ?? '9999-12-31';
      const units = [[0, 2], [1, 3], [5, 5], [32, 2]].filter(([days]) => dayAgo(days) >= start && dayAgo(days) <= end).reduce((sum, [, quantity]) => sum + quantity, 0);
      const overview = (await response.json()).overview;
      expect(overview.summary).toMatchObject({ revenue: units * 100, grossProfit: units * 40, unitsSold: units });
      await expect(stat(page, 'Equipos vendidos')).toHaveText(String(units));
      await expect.poll(async () => amount(await stat(page, 'Ventas').innerText())).toBe(units * 100);
      await shot(page, info, `dashboard-pendientes-${preset.replaceAll(' ', '-')}`);
    }
    if (width === 1440) await page.getByRole('button', { name: /^Elegir período,/ }).click();
    else await page.locator('.dashboard-month-nav button').nth(1).click();
    const calendar = page.getByRole('dialog', { name: 'Elegir período' });
    const start = dayAgo(5);
    if (start.slice(0, 7) !== today.slice(0, 7)) await calendar.getByRole('button', { name: 'Mes anterior del calendario' }).click();
    await calendar.locator(`[data-day="${start}"]`).click();
    if (start.slice(0, 7) !== today.slice(0, 7)) await calendar.getByRole('button', { name: 'Mes siguiente del calendario' }).click();
    await calendar.locator(`[data-day="${today}"]`).click();
    const manual = page.waitForResponse(response => response.url().includes('/api/reports/overview') && response.ok());
    await calendar.getByRole('button', { name: 'Aplicar', exact: true }).click();
    expect((await (await manual).json()).overview.summary).toMatchObject({ revenue: 1000, grossProfit: 400, unitsSold: 10 });
    await expect(stat(page, 'Equipos vendidos')).toHaveText('10');
    await shot(page, info, 'dashboard-pendientes-rango-manual');
  });

  test('Ventas: cantidades, precios unitarios, totales, ganancia y scroll', async ({ page }, info) => {
    await signIn(page, fixture.email);
    await openDeskSection(page, 'sales');
    if (width === 1440) {
      const table = page.locator('.desktop-table-scroll');
      const headers = await table.getByRole('columnheader').allTextContents();
      for (const name of ['Cant.', 'Precio unit.', 'Total', 'Ganancia']) expect(headers.some(header => header.includes(name))).toBe(true);
      expect(headers.findIndex(header => header.includes('Precio unit.'))).toBeLessThan(headers.findIndex(header => header.includes('Total')));
      const row = table.getByRole('row').filter({ hasText: `V-${String(fixture.partialSale.saleNumber).padStart(4, '0')}` });
      await expect(row).toBeVisible();
      await expect(row.locator('.sale-quantity-cell')).toHaveText('10');
      const geometry = await table.evaluate(node => {
        node.scrollLeft = node.scrollWidth;
        return { scroll: node.scrollLeft, width: node.clientWidth, content: node.scrollWidth, right: node.getBoundingClientRect().right,
          lastRight: node.querySelector('tbody tr')!.lastElementChild!.getBoundingClientRect().right };
      });
      expect(geometry.lastRight).toBeLessThanOrEqual(geometry.right + 1);
      if (geometry.content > geometry.width) expect(geometry.scroll).toBeGreaterThan(0);
    } else {
      await expect(page.locator('.sales-screen .phone-row').first()).toBeVisible();
      await expect(page.locator('.desktop-table-scroll')).toHaveCount(0);
    }
    await shot(page, info, 'ventas-columnas-cantidades');
  });

  test('Admin: historial real de cargas, cambios, bajas y una entrada diaria', async ({ page, request }, info) => {
    await call(request, adminEmail, 'GET', '/api/me');
    const { inventoryItem } = await call(request, fixture.email, 'POST', '/api/inventory', { model: 'Equipo auditable QA', capacity: '64GB', color: 'Negro', condition: 'NUEVO', grade: 'A+', batteryHealth: '100%', cost: 10, price: 20, currency: 'USD', status: 'DISPONIBLE' });
    await call(request, fixture.email, 'PATCH', `/api/inventory/${inventoryItem.id}`, { price: 25 });
    await call(request, fixture.email, 'DELETE', `/api/inventory/${inventoryItem.id}`);
    // Repeated session resolution must retain exactly one active_day per user/store/day.
    for (let i = 0; i < 3; i++) await call(request, fixture.email, 'GET', '/api/me');
    const history = await call(request, adminEmail, 'GET', `/admin/stores/${fixture.store.id}/history?limit=100`);
    await info.attach('real-history', { body: JSON.stringify(history, null, 2), contentType: 'application/json' });
    expect(history.actions.filter((action: { text: string; actor: { name: string } }) => action.text === 'Entró a la app' && action.actor.name.toLowerCase().includes('qa wholesale')).length).toBe(1);
    for (const word of ['equipo', 'venta']) expect(history.actions.some((action: { text: string }) => action.text.toLowerCase().includes(word))).toBe(true);
    for (const text of ['Registró un equipo', 'Cambió el precio', 'Archivó un equipo']) {
      expect(history.actions.some((action: { text: string }) => action.text === text), text).toBe(true);
    }
    await signIn(page, adminEmail, '/admin/actividad');
    await expect(page.getByRole('heading', { name: 'Actividad de tiendas' })).toBeVisible();
    await page.getByRole('button', { name: 'Ocultar tiendas de prueba' }).click();
    const search = page.getByRole('searchbox');
    if (await search.count()) await search.fill(fixture.store.name);
    const store = page.getByTestId(width === 390 ? `activity-card-${fixture.store.id}` : `activity-row-${fixture.store.id}`);
    await expect(store).toBeVisible();
    await shot(page, info, 'admin-actividad');
    await store.click();
    await expect(page.getByRole('heading', { name: 'Historial de acciones' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Acciones de la tienda' }).locator('li').first()).toBeVisible();
    await shot(page, info, 'admin-historial');
    await page.getByLabel('Tipo de acción').selectOption('inventory');
    await expect(page.getByRole('list', { name: 'Acciones de la tienda' })).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.history-list')).toContainText('equipo');
    await page.getByLabel('Desde').fill(today);
    await page.getByLabel('Hasta').fill(today);
    await expect(page.locator('.history-list li').first()).toBeVisible();
    await shot(page, info, 'admin-historial-filtros');
  });

  test('Devolución parcial: 200 de 1000 revierte solo 80 de ganancia en todos los módulos', async ({ page, request }, info) => {
    await signIn(page, fixture.email);
    await openDeskSection(page, 'sales');
    const salesRevenue = width === 1440 ? stat(page, 'Facturación total') : page.getByTestId('sales-hero').locator(':scope > .big');
    const salesProfit = width === 1440 ? stat(page, 'Ganancia total') : page.locator('.sale-hero-margin .mid');
    await expect(salesRevenue).toContainText('US$');
    const beforeSales = { revenue: amount(await salesRevenue.innerText()), profit: amount(await salesProfit.innerText()) };
    await openDeskSection(page, 'reports');
    await expect(page.getByTestId('net-profit')).toBeVisible();
    const beforeReports = { revenue: amount(await page.locator('.gamount').innerText()), profit: amount(await stat(page, 'Ganancia bruta').innerText()) };
    await openDeskSection(page, 'dashboard');
    await expect(page.locator('.dashboard-kpi-value').first()).toContainText('US$');
    const beforeDashboard = { revenue: amount(await stat(page, 'Ventas').innerText()), profit: amount(await stat(page, 'Margen bruto').innerText()) };
    await openDeskSection(page, 'sales');
    const code = `V-${String(fixture.partialSale.saleNumber).padStart(4, '0')}`;
    if (width === 1440) await page.getByRole('row').filter({ hasText: code }).click();
    else await page.locator('.phone-row').filter({ hasText: code }).click();
    const sale = page.getByRole('dialog');
    await (await sheetAction(sale, 'Devolver')).click();
    const form = page.getByRole('dialog', { name: 'Nuevo reclamo' });
    await form.getByLabel('Motivo').fill('Devolución de dos unidades de diez, importe parcial US$ 200');
    await form.getByRole('button', { name: 'Abrir reclamo', exact: true }).click();
    await expect(form).toBeHidden();
    const claims = (await call(request, fixture.email, 'GET', '/api/returns')).returns;
    const claim = claims.find((row: { saleId: string }) => row.saleId === fixture.partialSale.id);
    expect(claim).toBeTruthy();
    await openDeskSection(page, 'returns');
    await page.getByTestId(`return-${claim.id}`).click();
    const detail = page.getByRole('dialog');
    await detail.getByRole('button', { name: 'Cambiar estado', exact: true }).click();
    await detail.getByRole('button', { name: 'Resuelto', exact: true }).click();
    await detail.getByRole('button', { name: 'Reintegro', exact: true }).click();
    await detail.getByRole('button', { name: 'Reintegro en caja', exact: true }).click();
    await detail.getByLabel('Importe', { exact: true }).fill('200');
    await shot(page, info, 'devolucion-parcial-formulario');
    await detail.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(detail).toBeHidden();
    const query = new URLSearchParams({ rangeKey: 'custom', startDate: `${today}T00:00:00.000-03:00`, endDate: `${today}T23:59:59.999-03:00` });
    const overview = (await call(request, fixture.email, 'GET', `/api/reports/overview?${query}`)).overview;
    expect.soft(overview.summary).toMatchObject({ revenue: 3000, grossProfit: 1200, marginRate: 40, returnsAmount: 200 });
    expect.soft(overview.salesSeries.reduce((sum: number, point: { revenue: number }) => sum + point.revenue, 0)).toBe(3000);
    const net = await call(request, fixture.email, 'GET', `/api/reports/net-profit?from=${today}&to=${today}`);
    expect.soft(net).toMatchObject({ revenue: 3000, cost: 1800, grossProfit: 1200, netProfit: 1200 });
    await openDeskSection(page, 'sales');
    await expect(salesRevenue).toContainText('US$');
    expect.soft(amount(await salesRevenue.innerText())).toBe(beforeSales.revenue - 200);
    expect.soft(amount(await salesProfit.innerText())).toBe(beforeSales.profit - 80);
    if (width === 1440) {
      const row = page.getByRole('row').filter({ hasText: code });
      const columns = await page.locator('.desktop-table-scroll th').allTextContents();
      expect.soft(amount(await row.locator('td').nth(columns.findIndex(text => text.includes('Ganancia'))).innerText())).toBe(320);
    }
    await shot(page, info, 'devolucion-parcial-ventas');
    await openDeskSection(page, 'dashboard');
    await expect(stat(page, 'Ventas')).toContainText('US$');
    await expect.poll(async () => amount(await stat(page, 'Ventas').innerText())).toBe(beforeDashboard.revenue - 200);
    expect.soft(amount(await stat(page, 'Margen bruto').innerText())).toBe(beforeDashboard.profit - 80);
    await shot(page, info, 'devolucion-parcial-dashboard');
    await openDeskSection(page, 'clients');
    await page.getByTestId(`client-row-${fixture.returnClient.id}`).click();
    await expect(page.getByTestId('client-purchase-stats').locator('.cl-spending-total .big')).toHaveText('US$ 800');
    await expect(page.getByTestId(`purchase-sale-${fixture.partialSale.id}`).locator('.buy-amt')).toHaveText('US$ 800');
    await shot(page, info, 'devolucion-parcial-cliente');
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await openDeskSection(page, 'reports');
    await expect(page.getByTestId('net-profit')).toBeVisible();
    expect.soft(amount(await page.locator('.gamount').innerText())).toBe(beforeReports.revenue - 200);
    expect.soft(amount(await stat(page, 'Ganancia bruta').innerText())).toBe(beforeReports.profit - 80);
    expect.soft(amount(await stat(page, 'Ganancia neta').innerText())).toBe(beforeReports.profit - 80);
    await shot(page, info, 'devolucion-parcial-reportes');
    await page.getByTestId('net-profit').scrollIntoViewIfNeeded();
    await shot(page, info, 'devolucion-parcial-reportes-ganancia');
  });

  test('Devolución de unidades: devolver dos de diez repone exactamente dos al stock', { tag: '@known-bug' }, async ({ page, request }, info) => {
    const { inventoryItem } = await call(request, fixture.email, 'POST', '/api/inventory', {
      model: 'Lote devolución física QA', capacity: '64GB', color: 'Negro', condition: 'NUEVO', grade: 'A+', batteryHealth: '100%',
      cantidad: 10, cost: 60, price: 100, currency: 'USD', status: 'DISPONIBLE',
    });
    const { sale } = await call(request, fixture.email, 'POST', '/api/operations/sales', {
      clientId: fixture.returnClient.id, productId: inventoryItem.id, date: today, cantidad: 10, amount: 1000, unitPrice: 100, currency: 'USD', status: 'COMPLETADA',
    });
    // API currently accepts the payload but silently discards the returned-unit count.
    const opened = await call(request, fixture.email, 'POST', '/api/returns', { saleId: sale.id, reason: 'Devolver dos unidades de diez', openedOn: today, cantidad: 2 });
    await call(request, fixture.email, 'POST', `/api/returns/${opened.return.id}/resolve`, { resolution: 'REINTEGRO', settlement: 'REINTEGRO', amount: 200, destination: 'STOCK', stockStatus: 'EN_REVISION', cantidad: 2 });
    const { inventory } = await call(request, fixture.email, 'GET', '/api/inventory');
    const returned = inventory.find((row: { id: string }) => row.id === inventoryItem.id);
    await info.attach('returned-stock', { body: JSON.stringify(returned, null, 2), contentType: 'application/json' });
    await signIn(page, fixture.email);
    await openDeskSection(page, 'inventory');
    await shot(page, info, 'devolucion-unidades-stock');
    expect(returned.cantidad, 'Only the two returned units should re-enter inventory').toBe(2);
  });

  test('permisos: propietario y empleado reciben 403 en admin', async ({ page, request }, info) => {
    for (const email of [fixture.email, fixture.staffEmail]) {
      for (const path of ['/admin/store-activity', `/admin/stores/${fixture.store.id}/history`]) {
        const denied = await request.get(`${api}${path}`, { headers: authHeaders(email) });
        expect(denied.status(), `${email}: ${path}`).toBe(403);
      }
    }
    await signIn(page, fixture.email, '/admin/actividad');
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
    await shot(page, info, 'propietario-admin-denegado');
  });

  test('permisos: empleado sin acceso financiero no ve montos ni ganancias', { tag: '@known-bug' }, async ({ page, request }, info) => {
    const report = await request.get(`${api}/api/reports/overview`, { headers: authHeaders(fixture.staffEmail) });
    expect.soft(report.status(), 'Staff without reports permission must not read financial reports').toBe(403);
    await signIn(page, fixture.staffEmail);
    await expect(page.locator('.dashboard-screen .dstats')).toBeVisible();
    await expect(page.getByTestId('dashboard-initial-loading')).toHaveCount(0);
    await expect(page.locator('.dashboard-screen .dstat[aria-busy="true"]')).toHaveCount(0);
    expect.soft(await stat(page, 'Margen bruto').count()).toBe(0);
    await shot(page, info, 'empleado-dashboard');
    await openDeskSection(page, 'sales');
    expect.soft(await page.getByText('Ganancia total', { exact: true }).count()).toBe(0);
    await shot(page, info, 'empleado-ventas');
  });

  test('Exploración: confirmar canje pendiente, revisar reparación y reportes', async ({ page, request }, info) => {
    await signIn(page, fixture.email);
    await openDeskSection(page, 'tradeins');
    await page.getByRole('button', { name: /Equipo canje QA Retomar$/ }).click();
    const trade = page.getByRole('dialog', { name: 'Retomar canje' });
    await trade.getByLabel('Cliente', { exact: true }).fill('Cliente canje confirmado ficticio');
    await trade.getByRole('combobox', { name: 'Equipo', exact: true }).fill('Equipo salida canje ficticio');
    await trade.getByLabel('Precio completo de salida').fill('100');
    await trade.getByRole('button', { name: 'Confirmar canje', exact: true }).click();
    await expect(trade).toBeHidden();
    const { tradeIns } = await call(request, fixture.email, 'GET', '/api/trade-ins');
    const confirmed = tradeIns.find((row: { deviceReceived: string }) => row.deviceReceived === 'Equipo canje QA');
    expect(confirmed.confirmationStatus).toBe('CONFIRMED');
    expect(confirmed.saleId).toBeTruthy();
    await shot(page, info, 'canje-confirmado');
    await openDeskSection(page, 'service');
    const repair = page.locator('[data-testid^="repair-card-"]').filter({ hasText: 'Equipo reparación QA' });
    await expect(repair).toBeVisible();
    await repair.click();
    await expect(page.getByRole('dialog')).toContainText('Pantalla');
    await expect(page.getByRole('dialog')).toContainText('US$ 50');
    await shot(page, info, 'reparacion-detalle');
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await openDeskSection(page, 'reports');
    for (const section of ['Stock', 'Canjes', 'Clientes', 'Servicio']) {
      await page.getByRole('group', { name: 'Tipo de reporte' }).getByRole('button', { name: section, exact: true }).click();
      await expect(page.locator('.gamount')).not.toHaveText('NaN');
      await shot(page, info, `reporte-${section.toLowerCase()}`);
    }
  });
});
