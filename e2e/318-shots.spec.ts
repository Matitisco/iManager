import { expandListOptions } from './navigation';
import { expect, test } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const blind = {
  id: 'count-1',
  subtitle: 'Abierto por Matías · hoy 09:10 · contando Lucía y Tomás',
  mine: 18,
  total: 31,
  scans: [
    { id: 's1', createdAt: '2026-10-19T12:42:00.000Z', result: 'FOUND', imei: '352098117744521', model: 'iPhone 13', capacity: '128GB', color: 'Medianoche' },
    { id: 's2', createdAt: '2026-10-19T12:41:00.000Z', result: 'NOT_LOADED', imei: '352098117747702', model: null, capacity: null, color: null },
    { id: 's3', createdAt: '2026-10-19T12:40:00.000Z', result: 'FOUND', imei: '352098117748830', model: 'iPhone 15 Pro', capacity: '256GB', color: 'Titanio negro' },
    { id: 's4', createdAt: '2026-10-19T12:39:00.000Z', result: 'SOLD', imei: '352098117746612', model: 'iPhone 11', capacity: '64GB', color: null },
    { id: 's5', createdAt: '2026-10-19T12:38:00.000Z', result: 'FOUND', imei: '352098117742207', model: 'iPhone 14', capacity: '128GB', color: 'Azul' },
    { id: 's6', createdAt: '2026-10-19T12:37:00.000Z', result: 'FOUND', imei: '352098117740917', model: 'iPhone 12', capacity: '64GB', color: 'Blanco' },
  ],
};

function line(key: string, imei: string, model: string, capacity: string, color: string, price: number | null) {
  return { key, inventoryItemId: price == null ? null : key, imei, model, capacity, color, price, currency: price == null ? null : 'ARS', note: null as string | null };
}

const closed = {
  id: 'count-1',
  status: 'CLOSED',
  resolution: null as string | null,
  subtitle: 'Cerrado hoy 11:05 · contaron Lucía y Tomás · 49 escaneos',
  summary: '36 coinciden · 3 faltan · 2 sobran · 1 figura vendido',
  startedAt: '2026-10-19T12:10:00.000Z',
  closedAt: '2026-10-19T14:05:00.000Z',
  excludedNoImei: 3,
  scanCount: 49,
  buckets: {
    matched: Array.from({ length: 36 }, (_, index) => line(`ok-${index}`, `35209811770${String(index).padStart(4, '0')}`, 'iPhone 13', '128GB', 'Negro', 800000)),
    missing: [
      line('miss-1', '352098117741188', 'iPhone 13 mini', '128GB', 'Rosa', 560000),
      line('miss-2', '352098117747731', 'iPhone 11', '128GB', 'Negro', 360000),
      line('miss-3', '352098117745521', 'iPhone XR', '64GB', 'Azul', 240000),
    ],
    surplus: [
      { ...line('extra-1', '352098117747702', '', '', '', null), note: 'No está cargado' },
      { ...line('extra-2', '352098117749900', '', '', '', null), note: 'No está cargado' },
    ],
    sold: [{ ...line('sold-1', '352098117746612', 'iPhone 11', '64GB', 'Negro', 330000), note: 'Se vendió durante el conteo' }],
  },
};

for (const width of [390, 1440]) {
  test(`control de stock ${width}`, async ({ page }) => {
    const mobile = width === 390;
    await page.setViewportSize({ width, height: mobile ? 844 : 1100 });
    await page.addInitScript(() => {
      localStorage.setItem('imanager:install-dismissed:ios', 'yes');
      localStorage.setItem('imanager:install-dismissed:android', 'yes');
    });
    let phase: 'empty' | 'counting' | 'closed' | 'recorded' = 'empty';
    let resolveMode = '';
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1535, venta: 1555, fechaActualizacion: '2026-10-19T12:00:00Z' } }));
    await page.context().route('**/api/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const path = new URL(request.url()).pathname;
      const json = (value: unknown, status = 200) => route.fulfill({ json: value, status, headers: cors });
      if (path === '/api/me') {
        return json({
          ...me,
          user: { ...me.user, displayName: 'Matías Tiscornia', email: 'matias@example.test' },
          store: { ...me.store, name: 'Tienda Ejemplo' },
          membership: { role: 'OWNER', isDefault: true },
          onboardingRequired: false,
        });
      }
      if (path === '/api/stock-counts/preview') return json({ excludedNoImei: 3, scope: 'Disponibles, reservados y en revisión', counters: 'Todo el equipo con Inventario' });
      if (path === '/api/stock-counts/current') return json({ count: phase === 'counting' ? blind : null });
      if (path === '/api/stock-counts' && request.method() === 'POST') {
        phase = 'counting';
        return json({ count: blind }, 201);
      }
      if (path === '/api/stock-counts/count-1/scans' && request.method() === 'POST') {
        const body = request.postDataJSON() as { imei?: string };
        return json({
          count: {
            ...blind,
            mine: 19,
            total: 32,
            scans: [{ id: 's-new', createdAt: '2026-10-19T12:43:00.000Z', result: 'FOUND', imei: body.imei, model: 'iPhone 13', capacity: '128GB', color: 'Medianoche' }, ...blind.scans],
          },
        });
      }
      if (path === '/api/stock-counts/count-1/close' && request.method() === 'POST') {
        phase = 'closed';
        return json({ count: closed });
      }
      if (path === '/api/stock-counts/count-1/resolve' && request.method() === 'POST') {
        const body = request.postDataJSON() as { mode?: string; missingIds?: string[] };
        resolveMode = body.mode ?? '';
        phase = 'recorded';
        return json({ count: { ...closed, resolution: body.mode === 'ADJUST' ? 'ADJUSTED' : 'RECORDED' } });
      }
      if (path === '/api/stock-counts/count-1') return json({ count: { ...closed, resolution: phase === 'recorded' ? 'RECORDED' : null } });
      if (path === '/api/stock-counts') {
        const summary = '36 coinciden · 3 faltan · 2 sobran · 1 figura vendido';
        if (phase === 'empty') return json({ counts: [] });
        if (phase === 'counting') return json({ counts: [{ id: 'count-1', status: 'OPEN', resolution: null, subtitle: blind.subtitle, summary: null, startedAt: closed.startedAt, closedAt: null }] });
        return json({ counts: [{ id: 'count-1', status: 'CLOSED', resolution: phase === 'recorded' ? 'RECORDED' : null, subtitle: 'Cerrado hoy 11:05 · contaron Lucía y Tomás', summary, startedAt: closed.startedAt, closedAt: closed.closedAt }] });
      }
      if (path === '/api/onboarding/progress') {
        return json({ stage: 'done', eligible: false, active: false, dismissed: true, stock: 1, sales: true, team: true, catalog: false, installed: false, visible: false, samples: 0, storeNamed: true, steps: { store: true, stock: true, sale: true, team: true, install: true } });
      }
      if (path.endsWith('/members')) return json({ members: [] });
      if (path === '/api/invitations') return json({ invitations: [] });
      if (path === '/api/notifications') return json({ notifications: [] });
      return json({ inventory: [], sales: [], clients: [], tradeIns: [], repairs: [], categories: [], catalogs: {}, drafts: [] });
    });

    await page.goto('/');
    await page.getByTestId('login-email').fill('matias@example.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.desk-app')).toBeVisible();
    await page.goto('/#/inv');
    await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
    await expandListOptions(page);
    await page.getByTestId('stock-count-entry').click();
    await expect(page.getByTestId('stock-empty')).toContainText('Todavía no hiciste controles de stock');
    await expect(page.getByText('Faltan')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.stage').evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: `docs/pr-shots/318-vacio-${width}.png`, animations: 'disabled' });

    await page.getByRole('button', { name: 'Iniciar control' }).click();
    const sheet = page.getByRole('dialog', { name: 'Iniciar control' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('3 equipos sin IMEI quedan fuera.')).toBeVisible();
    await expect(sheet.getByText('Faltan', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('iPhone 13 mini', { exact: false })).toHaveCount(0);
    await page.locator('.stage').evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: `docs/pr-shots/318-iniciar-${width}.png`, animations: 'disabled' });
    await sheet.getByRole('button', { name: 'Iniciar conteo' }).click();

    const input = page.getByTestId('stock-scan-input');
    await expect(input).toBeFocused();
    await expect(page.getByText('18 tuyos · 31 en total')).toBeVisible();
    await expect(page.getByText('Encontrado · iPhone 13 · 128GB')).toBeVisible();
    await expect(page.getByText('Faltan', { exact: true })).toHaveCount(0);
    await expect(page.getByText('iPhone 13 mini', { exact: false })).toHaveCount(0);
    await page.locator('.stage').evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: `docs/pr-shots/318-contando-${width}.png`, animations: 'disabled' });

    await input.fill('352098117744521');
    await input.press('Enter');
    await expect(page.getByText('19 tuyos · 32 en total')).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(page.getByText('Faltan')).toHaveCount(0);

    await page.getByTestId('stock-close').click();
    await expect(page.getByRole('region', { name: 'Resultado del conteo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sin escanear 3' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('stock-excluded')).toContainText('3 sin IMEI fuera del conteo');
    await page.locator('.stage').evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: `docs/pr-shots/318-resultado-${width}.png`, animations: 'disabled' });
    await page.getByTestId('stock-record').click();
    await expect.poll(() => resolveMode).toBe('RECORD');
    await expect(page.getByText('Registrado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Coinciden 36' })).toBeVisible();
  });
}
