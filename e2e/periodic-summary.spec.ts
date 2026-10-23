import { openDeskSection } from './navigation';
import { expect, test } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

// A single flow checks the real shell at both supported widths with isolated HTTP fixtures.
test('periodic summary: periods, complete breakdown, empty and recovery at 390px and 1440px', async ({ page }, testInfo) => {
  const month = { id: 'month:2026-09', kind: 'month', from: '2026-09-01', to: '2026-09-30', label: 'septiembre de 2026' };
  const half = { id: 'half:2026-10-01', kind: 'half', from: '2026-10-01', to: '2026-10-15', label: '01 al 15/10/2026' };
  let failed = false;
  const summary = (selection: string) => {
    const empty = selection === 'latest-half';
    return {
      period: empty ? half : month, periods: { months: [month], halves: [half] },
      sales: { total: empty ? [] : [{ amount: 27291812, currency: 'ARS' }], items: empty ? [] : Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: ['iPhone 15 Pro 256GB', 'iPhone 14 128GB', 'iPhone 13 128GB', 'iPhone 16 Pro 256GB', 'iPhone 12 64GB'][i], day: '2026-09-28', detail: 'Nicolás Pereyra', amount: i === 1 ? 780000 : 1150000, currency: 'ARS', voided: i === 1 })) },
      returns: { total: empty ? [] : [{ amount: 280, currency: 'USD' }], items: empty ? [] : [
        { id: 'r1', title: 'AirPods Pro 2 · reintegro', day: '2026-09-19', detail: 'Roberto Carlos', amount: 180, currency: 'USD', pending: false, status: 'RESUELTO' },
        { id: 'r2', title: 'Cargador 20W · nota de crédito', day: '2026-09-12', detail: 'Sofía Benítez', amount: 100, currency: 'USD', pending: false, status: 'RESUELTO' },
        { id: 'r3', title: 'iPhone 12 64GB · RMA', day: '2026-09-05', detail: 'IMEI 353912087741265', amount: 0, currency: 'USD', pending: true, status: 'ENVIADO' },
      ] },
      stock: { count: empty ? 0 : 4, counts: empty ? 0 : 1, latestDay: empty ? null : '2026-09-28', items: empty ? [] : Array.from({ length: 4 }, (_, i) => ({ id: `d${i}`, day: '2026-09-28', title: ['iPhone 13 128GB', 'iPhone 14 Pro 256GB', 'iPhone 12 64GB', 'iPhone 15 Pro 256GB'][i], imei: `35209411337780${i}`, status: i < 2 ? 'Falta' : 'Sobra' })) },
    };
  };
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('imanager:install-dismissed:ios', 'yes'));
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1545, venta: 1565, fechaActualizacion: new Date().toISOString() } }));
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
  await page.route('**/api/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ json: body, status, headers: cors });
    if (url.pathname === '/api/me') return json(me);
    if (url.pathname === '/api/reports/periodic-summary') return failed ? json({ error: 'No se pudo cargar el resumen periódico' }, 503) : json(summary(url.searchParams.get('period') ?? 'latest-half'));
    if (url.pathname === '/api/onboarding/progress') return json({ eligible: false, active: false, visible: false, dismissed: true, steps: {} });
    if (url.pathname.endsWith('/members')) return json({ members: [] });
    if (url.pathname === '/api/section-views') return json({ sections: {} });
    return json({ inventory: [], sales: [], clients: [], tradeIns: [], returns: [], expenses: [], repairs: [], categories: [], notifications: [], invitations: [], catalogs: {}, drafts: [] });
  });
  await page.goto('/');
  await page.getByTestId('login-email').fill('owner@summary.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/#/analisis/reportes');
    await openDeskSection(page, 'periodicSummary');
    await expect(page.getByRole('region', { name: 'Ventas' })).toBeVisible();
    await expect(page.locator('.periodic-total').filter({ hasText: /^\$ 0$/ })).toHaveCount(2);
    await expect(page.getByText('0 equipos', { exact: true })).toBeVisible();
    await expect(page.locator('.periodic-card .periodic-note, .periodic-range')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`empty-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Último mes' }).click();
    await expect(page.getByText('En curso')).toBeVisible();
    await expect(page.locator('.periodic-void s')).toHaveText('$ 780.000');
    await expect(page.getByText('Anulada, no suma')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`summary-${width}.png`), fullPage: true });
    const boxes = await page.locator('.periodic-card').evaluateAll(elements => elements.map(el => { const rect = el.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }; }));
    if (width === 390) {
      expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].bottom);
      expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[1].bottom);
    } else expect(new Set(boxes.map(box => box.y)).size).toBe(1);
    expect(boxes.every(box => box.x >= 0 && box.right <= width)).toBe(true);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.stage, .periodic-summary')].some(el => el.scrollWidth > el.clientWidth + 1));
    expect(overflow).toBe(false);
    await page.getByRole('button', { name: 'Ver todas las ventas (5)' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ventas' });
    await expect(dialog.getByRole('listitem')).toHaveCount(5);
    await dialog.getByText('iPhone 12 64GB', { exact: true }).scrollIntoViewIfNeeded();
    await expect(dialog.getByText('iPhone 12 64GB', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`modal-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    for (const [name, title, count] of [
      ['Ver todas las devoluciones y rma (3)', 'Devoluciones y RMA', 3],
      ['Ver todas las diferencias de stock (4)', 'Diferencias de stock', 4],
    ] as const) {
      await page.getByRole('button', { name }).click();
      const breakdown = page.getByRole('dialog', { name: title });
      await expect(breakdown.getByRole('listitem')).toHaveCount(count);
      const bounds = await breakdown.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await breakdown.locator('.sheet-scroll').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await breakdown.getByRole('button', { name: 'Cerrar' }).click();
      await expect(page.getByRole('button', { name })).toBeFocused();
    }
    await page.getByRole('combobox', { name: 'Períodos anteriores' }).click();
    await page.getByRole('option', { name: 'septiembre de 2026' }).click();
    await expect(page.getByText('En curso')).toBeVisible();
    failed = true;
    const failure = page.waitForResponse(response => response.url().includes('/api/reports/periodic-summary') && response.status() === 503);
    await page.getByRole('button', { name: 'Última quincena' }).click();
    await failure;
    await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toHaveCount(0);
    await expect(page.locator('.periodic-card')).toHaveCount(0);
    await expect(page.getByText(/Cargando|Reintentar/, { exact: true })).toHaveCount(0);
    failed = false;
    await page.getByRole('button', { name: 'Último mes' }).click();
    await page.getByRole('button', { name: 'Última quincena' }).click();
    await expect(page.getByText('0 equipos', { exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
