import { expect, test } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';

const supplier = {
  id: 'sup-1',
  name: 'Mayorista Centro',
  phone: '1144445555',
  email: 'ventas@mayorista.test',
  notes: 'Entrega los martes.',
  deviceCount: 2,
  problemCount: 1,
  deletedAt: null,
  lastPurchaseAt: '2026-10-10',
  purchases: [{
    id: 'buy-1',
    purchasedAt: '2026-10-10',
    notes: 'Lote de octubre.',
    problemCount: 1,
    items: [
      { id: 'eq-1', model: 'iPhone 13', capacity: '128 GB', imei: '359111111111119', status: 'DISPONIBLE', cost: 80000, currency: 'ARS', problem: false, problemLabel: null, createdAt: '2026-10-10T15:00:00.000Z' },
      { id: 'eq-2', model: 'iPhone 12', capacity: '64 GB', imei: '359222222222228', status: 'EN_REVISION', cost: 50000, currency: 'ARS', problem: true, problemLabel: 'En revisión', createdAt: '2026-10-10T15:00:00.000Z' },
    ],
  }],
};

const inventory = [
  { id: 'eq-1', imei: '359111111111119', model: 'iPhone 13', capacity: '128 GB', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 80000, price: 200000, currency: 'ARS', status: 'VENDIDO', supplierId: 'sup-1', supplierName: 'Mayorista Centro', createdAt: '2026-10-10T15:00:00.000Z' },
  { id: 'eq-2', imei: '359222222222228', model: 'iPhone 12', capacity: '64 GB', color: 'Negro', condition: 'USADO', grade: 'B', batteryHealth: '86%', cost: 50000, price: 140000, currency: 'ARS', status: 'EN_REVISION', supplierId: 'sup-1', supplierName: 'Mayorista Centro', createdAt: '2026-10-10T15:00:00.000Z' },
];

const sales = [
  { id: 'sale-1', saleNumber: 18, date: '2026-10-12', clientId: 'cl-1', clientName: 'Lucía Martínez', productId: 'eq-1', amount: 200000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' },
];

const expenses = [
  { id: 'ex-1', date: '2026-10-12', category: 'Alquiler', amount: 10000, currency: 'ARS', exchangeRate: 1300, notes: 'Local de octubre', deletedAt: null },
  { id: 'ex-2', date: '2026-10-12', category: 'Publicidad', amount: 10, currency: 'USD', exchangeRate: 1300, notes: null, deletedAt: null },
];

const phase = process.env.ISSUE_457_PHASE ?? 'after';
for (const width of [390, 1440]) {
  test(`finanzas ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.clock.install({ time: new Date('2026-10-21T17:30:00Z') });
    await page.addInitScript(() => {
      localStorage.setItem('imanager:install-dismissed:ios', 'yes');
      localStorage.setItem('imanager:install-dismissed:android', 'yes');
    });
    let status = 'OPEN';
    let role = 'OWNER';
    let scenario = 'data';
    const writes: string[] = [];
    const unexpected: string[] = [];
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    const count = { id: 'count-1', expected: 1531500, counted: 1531000, difference: -500, note: 'Revisar billetes', countedBy: me.user.id, createdAt: '2026-10-21T17:00:00Z', denominations: null };
    const session = () => ({ id: 'session-1', day: status === 'APPROVED' ? '2026-10-20' : '2026-10-21', status, reviewNote: status === 'RECOUNT' ? 'Revisá el cajón de billetes.' : null, openedAt: status === 'APPROVED' ? '2026-10-20T12:12:00Z' : '2026-10-21T12:12:00Z', openedBy: 'Ana', opening: 500000, ...(['SUBMITTED','APPROVED'].includes(status) ? { counts: [count] } : {}) });
    await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1535, venta: 1555, fechaActualizacion: '2026-10-21T17:00:00Z' } }));
    await page.context().route('**/api/**', async route => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const url = new URL(request.url());
      const path = url.pathname;
      const json = (value: unknown, code = 200) => route.fulfill({ json: value, status: code, headers: cors });
      if (request.method() !== 'GET') { writes.push(new URL(request.url()).pathname); return json({ error: 'Fallo sintético al guardar' }, 500); }
      if (path === '/api/me') return json({ ...me, store: { ...me.store, name: 'Tienda Ejemplo', currency: 'ARS', exchangeMode: 'manual', manualBuy: 1535, manualSell: 1555 }, membership: { role, isDefault: true, sections: role === 'STAFF' ? ['inventory','cash'] : null } });
      if (path === '/api/onboarding/progress') return json({ stage: 'done', eligible: false, active: false, dismissed: true, visible: false, steps: {} });
      if (path === '/api/cash' && scenario === 'cash-loading') return new Promise<void>(() => {});
      if (path === '/api/cash' && scenario === 'cash-error') return json({ error: 'Error sintético de cajas' }, 500);
      if (path === '/api/cash') return json({ canViewBalances: true, day: '2026-10-21', timezone: 'America/Argentina/Buenos_Aires', registers: scenario === 'empty' ? [] : [{ id: 'box-1', name: 'Caja principal · Local', currency: 'ARS', method: 'EFECTIVO', isDefault: true, archivedAt: null, balance: 1531500, session: session() }] });
      if (path.endsWith('/sessions')) return json({ sessions: [{ ...session(), id: 'previous-1', day: '2026-10-19', openedAt: '2026-10-19T12:12:00Z', status: 'APPROVED', counts: [{ ...count, createdAt: '2026-10-19T17:00:00Z' }] }] });
      if (path.endsWith('/movements')) return json({ movements: [{ id: 'move-1', amount: -18500, kind: 'EGRESO', category: 'Flete', note: 'Flete Andreani', createdAt: '2026-10-21T16:05:00Z', sourceType: 'fixture' }], total: 1, categories: ['Flete'] });
      if (path === '/api/suppliers') return scenario === 'error' ? json({ error: 'Error sintético de proveedores' }, 500) : json({ suppliers: scenario === 'empty' ? [] : [supplier] });
      if (path.startsWith('/api/suppliers/')) return json({ supplier });
      if (path === '/api/expenses') {
        if (scenario === 'loading') return new Promise<void>(() => {});
        if (scenario === 'error') return json({ error: 'Error sintético de gastos' }, 500);
        return json({ expenses: scenario === 'empty' ? [] : expenses });
      }
      if (path === '/api/reports/net-profit') return json({ currency: 'ARS', blocked: false, sellRate: 1555, revenue: 9000000, cost: 2200000, grossProfit: 6800000, expenses: 25550, netProfit: 6774450 });
      const empty: Record<string, unknown> = {
        '/api/health': { ok: true }, '/api/accounts/follow-ups': { today: '2026-10-21', settings: {}, cards: [], groups: [] }, '/api/clients/categories': { categories: [] }, '/api/commissions': { period: { key: '2026-10', label: 'octubre 2026' }, summary: { earned: { ARS: 0, USD: 0 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: 0, USD: 0 }, unassignedSalesCount: 0 }, people: [] }, '/api/commissions/rules': { rules: [], sellers: [] }, '/api/commissions/mine': { person: { pending: { ARS: 0, USD: 0 }, sales: [], payments: [] }, sales: [], payments: [], member: null, period: { key: '2026-10', label: 'octubre 2026' }, summary: { earned: { ARS: 0, USD: 0 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: 0, USD: 0 } }, rows: [] }, '/api/returns': { returns: [] }, '/api/returns/credit-notes': { creditNotes: [] }, '/api/operations/tradeins/drafts': { drafts: [] },
        '/api/inventory': { inventory }, '/api/sales': { sales }, '/api/clients': { clients: [] }, '/api/trade-ins': { tradeIns: [] }, '/api/repairs': { repairs: [] }, '/api/inventory/categories': { categories: [] }, '/api/notifications': { notifications: [] }, '/api/invitations': { invitations: [] }, '/api/operations/drafts': { drafts: [] }, '/api/catalogs': { catalogs: [] },
      };
      if (path in empty) return json(empty[path]);
      if (path.endsWith('/members')) return json({ members: [] });
      unexpected.push(path);
      return json({ error: `API no contemplada: ${path}` }, 501);
    });
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/issue-457/${phase}-${name}-${width}x${width === 390 ? 844 : 900}.png`, animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await page.goto('/');
    await page.getByTestId('login-email').fill('owner@example.test');
    await page.getByTestId('login-password').fill('test123456');
    await page.getByTestId('login-submit').click();
    await expect(page.locator('.desk-app')).toBeVisible();
    for (const [state, name] of [['OPEN','abierta'], ['SUBMITTED','esperando'], ['RECOUNT','reconteo'], ['APPROVED','cerrada']]) {
      status = state;
      await page.goto('/#/dashboard');
      await expect(page.getByRole('heading', { name: '¿Qué hay para hoy?' })).toBeVisible();
      await page.goto('/#/finanzas/cajas');
      await expect(page.getByTestId('cash-screen')).toBeVisible();
      await page.getByRole('button', { name: /Caja principal/ }).click();
      await expect(page.getByRole('heading', { name: 'Movimientos', exact: true })).toBeVisible();
      await shot(`caja-${name}`);
    }
    if (phase === 'after') {
      for (const state of ['empty', 'cash-error', 'cash-loading']) {
        scenario = state;
        await page.goto('/#/dashboard');
        await expect(page.getByRole('heading', { name: '¿Qué hay para hoy?' })).toBeVisible();
        await page.goto('/#/cajas');
        if (state === 'empty') await expect(page.getByText('Creá tu primera caja')).toBeVisible();
        else if (state === 'cash-error') await expect(page.getByRole('alert')).toBeVisible();
        else await expect(page.getByText('Cargando cajas…')).toBeVisible();
        await shot(`cajas-${state}`);
      }
      scenario = 'data';
    }
    await page.goto('/#/gastos');
    await expect(page.getByTestId('expenses-list')).toBeVisible();
    await shot('gastos');
    await page.getByTestId('expenses-list').scrollIntoViewIfNeeded();
    await shot('gastos-lista');
    await page.getByRole('button', { name: 'Nuevo gasto', exact: true }).filter({ visible: true }).click();
    await page.getByLabel('Categoría', { exact: true }).fill('Servicios');
    await page.getByLabel('Monto', { exact: true }).fill('38900');
    await page.getByLabel('Notas', { exact: true }).fill('Internet del local · octubre');
    await shot('gasto-nuevo');
    if (phase === 'after') {
      await page.setViewportSize({ width: 1536, height: 640 });
      await page.screenshot({ path: 'docs/issue-457/after-gasto-nuevo-1536x640.png', animations: 'disabled' });
      await expect(page.getByRole('button', { name: 'Guardar gasto', exact: true })).toBeInViewport();
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    }
    expect(writes).toEqual([]);
    if (phase === 'after') {
      await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await shot('gasto-error-guardado');
      await expect(page.getByLabel('Notas', { exact: true })).toHaveValue('Internet del local · octubre');
    }
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    if (phase === 'after') {
      for (const state of ['loading', 'empty', 'error']) {
        scenario = state;
        await page.getByRole('button', { name: 'Activos', exact: true }).click();
        await page.getByRole('button', { name: 'Archivados', exact: true }).click();
        if (state === 'loading') await expect(page.getByTestId('expenses-loading')).toBeVisible();
        if (state === 'empty') await expect(page.getByTestId('expenses-empty')).toBeVisible();
        if (state === 'error') await expect(page.getByRole('alert')).toBeVisible();
        await shot(`gastos-${state}`);
      }
      scenario = 'data';
    }
    await page.goto('/#/proveedores');
    await expect(page.getByTestId('suppliers-list')).toBeVisible();
    await shot('proveedores');
    await page.getByTestId('supplier-sup-1').click();
    await expect(page.getByTestId('supplier-detail')).toBeVisible();
    await shot('proveedor-detalle');
    if (phase === 'after') {
      await page.setViewportSize({ width: 1536, height: 640 });
      await page.screenshot({ path: 'docs/issue-457/after-proveedor-detalle-1536x640.png', animations: 'disabled' });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    }
    await page.keyboard.press('Escape');
    if (phase === 'after') {
      for (const state of ['empty', 'error']) {
        scenario = state;
        await page.getByRole('button', { name: 'Activos', exact: true }).click();
        await page.getByRole('button', { name: 'Archivados', exact: true }).click();
        if (state === 'empty') await expect(page.getByTestId('suppliers-empty')).toBeVisible();
        else await expect(page.getByRole('alert')).toBeVisible();
        await shot(`proveedores-${state}`);
      }
      scenario = 'data';
    }
    await page.goto('/#/mas');
    if (width === 390) await expect(page.getByTestId('more-screen')).toBeVisible();
    await shot('mas-dueno');
    role = 'STAFF';
    await page.reload();
    if (phase === 'after') await expect(page.getByText('Finanzas', { exact: true })).toHaveCount(0);
    if (width === 390) { await page.goto('/#/mas'); await expect(page.getByTestId('more-screen')).toBeVisible(); }
    await shot('mas-empleado');
    expect(writes).toEqual(phase === 'after' ? ['/api/expenses'] : []);
    expect(unexpected).toEqual([]);
  });
}
