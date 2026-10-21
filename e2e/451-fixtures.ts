import { expect, type Page } from '@playwright/test';
import { me } from './pwa/fixtures.mjs';
import { commissionFixturePeople } from '../src/test/commission-fixtures';
export type Scenario = 'normal' | 'error' | 'loading' | 'unavailable' | 'negative';
export async function reportsFixture(page: Page, scenario: Scenario = 'normal') {
  await page.clock.install({ time: new Date('2026-10-21T15:00:00Z') });
  await page.addInitScript(() => {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
  });
  const inventory = Array.from({ length: 57 }, (_, i) => ({
    id: `p${i}`, imei: `35911111111${String(i).padStart(4, '0')}`, model: i % 2 ? 'iPhone 15 Pro' : 'iPhone 13', capacity: '128 GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 480000, price: 980000, currency: 'ARS', status: i < 5 || (i >= 46 && i < 55) ? 'VENDIDO' : i < 7 ? 'RESERVADO' : 'DISPONIBLE', createdAt: i >= 55 ? undefined : i < 18 ? `2026-10-${String(1 + i).padStart(2, '0')}` : i < 33 ? '2026-09-10' : '2026-07-01',
  }));
  const sales = Array.from({ length: 14 }, (_, i) => ({ id: `s${i}`, saleNumber: i + 1, date: i < 6 ? `2026-10-${String(16 + i).padStart(2, '0')}` : `2026-09-${22 + i - 6}`, clientId: i % 2 ? 'c1' : 'c2', clientName: i % 2 ? 'Sofía Díaz' : 'Juan Pérez', productId: `p${i < 5 ? i : 46 + i - 5}`, amount: 1380000, amountCurrency: scenario === 'unavailable' ? 'USD' : 'ARS', paymentMethod: i % 2 ? 'EFECTIVO' : 'TRANSFERENCIA', status: 'COMPLETADA' }));
  sales.push({ ...sales[0], id: 'previous', date: '2026-08-25', productId: 'historical-product-unavailable', amount: 48300000 });
  const repairs = Array.from({ length: 14 }, (_, i) => ({ id: `r${i}`, orderNumber: i + 1, code: `OT-${i + 1}`, clientId: 'c1', clientName: 'Sofía Díaz', device: 'iPhone 13', fault: 'Pantalla', status: i < 9 ? 'ENTREGADO' : i < 12 ? 'EN_REPARACION' : 'RECIBIDO', receivedAt: `2026-10-${String(i + 1).padStart(2, '0')}`, estimate: i < 11 ? 160000 : null, currency: 'ARS', deposit: 0, events: i < 9 ? [{ id: `e${i}`, status: 'ENTREGADO', createdAt: `2026-10-${String(i + 4).padStart(2, '0')}T04:48:00-03:00` }] : [] }));
  repairs.push({ ...repairs[13], id: 'r-prior', receivedAt: '2026-08-25', estimate: 1571428.57 });
  const clients = [{ id: 'c1', name: 'Sofía Díaz', createdAt: '2026-10-01', dni: '12345678', phone: '', email: '', totalSpent: 0, pendingBalance: 0 }, { id: 'c2', name: 'Juan Pérez', createdAt: '2026-08-01', dni: '12345679', phone: '', email: '', totalSpent: 0, pendingBalance: 0 }];
  await page.route('https://dolarapi.com/**', route => scenario === 'unavailable' ? route.abort() : route.fulfill({ json: { compra: 1535, venta: 1555, fechaActualizacion: '2026-10-21T15:00:00Z' } }));
  const unexpected: string[] = [];
  await page.route('**/api/**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ headers, status, json: data });
    if (path === '/api/me') return json({ ...me, store: { ...me.store, name: 'Tienda Ejemplo', exchangeMode: scenario === 'unavailable' ? 'auto' : 'manual', manualBuy: scenario === 'unavailable' ? null : 1535, manualSell: scenario === 'unavailable' ? null : 1555 } });
    if (path === '/api/inventory') return json({ inventory });
    if (path === '/api/sales') {
      if (scenario === 'loading') return;
      return json(scenario === 'error' ? { message: 'No se pudieron cargar las ventas.' } : { sales }, scenario === 'error' ? 500 : 200);
    }
    if (path === '/api/clients') return json({ clients });
    if (path === '/api/repairs') return json({ orders: repairs });
    if (path === '/api/trade-ins') return json({ tradeIns: [] });
    if (path === '/api/expenses') return json({ expenses: [{ id: 'ex1', date: '2026-10-10', category: 'Alquiler', amount: 2150000, currency: 'ARS', deletedAt: null }] });
    if (path === '/api/returns') return json({ returns: [] });
    if (path === '/api/returns/credit-notes') return json({ creditNotes: [] });
    if (path === '/api/reports/commissions') { const from = url.searchParams.get('from') ?? '2026-10'; return json({ from, to: from, rows: commissionFixturePeople.map((p, i) => {
      if (scenario === 'negative' && i === 2) return { ...p, period: from, earned: { ARS: 0, USD: 0 }, adjustmentsTotal: { ARS: 0, USD: -10 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: 0, USD: -10 }, converted: { earned: { ARS: -15550, USD: -10 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: -15550, USD: -10 } } };
      const earnedARS = p.earned.ARS + p.adjustmentsTotal.ARS + (p.earned.USD + p.adjustmentsTotal.USD) * 1300;
      return { ...p, period: from, converted: { ...p.converted, earned: { ARS: earnedARS, USD: earnedARS / 1300 } } };
    }) }); }
    if (path === '/api/onboarding/progress') return json({ stage: 'done', eligible: false, active: false, dismissed: true, visible: false, steps: {} });
    const empty: Record<string, unknown> = {
      '/api/health': { ok: true }, '/api/accounts/follow-ups': { followUps: [] }, '/api/commissions': { period: { key: '2026-10', timezone: 'America/Argentina/Buenos_Aires' }, people: [], summary: { earned: { ARS: 0, USD: 0 }, paid: { ARS: 0, USD: 0 }, pending: { ARS: 0, USD: 0 } } }, '/api/commissions/rules': { rules: [] }, '/api/operations/tradeins/drafts': { drafts: [], tradeIns: [] }, '/api/clients/categories': { categories: [] }, '/api/inventory/categories': { categories: [] }, '/api/notifications': { notifications: [] }, '/api/operations/drafts': { drafts: [], tradeIns: [] }, '/api/invitations': { invitations: [] }, '/api/suppliers': { suppliers: [] }, '/api/catalogs': { catalogs: {} },
    };
    if (path.endsWith('/members')) return json({ members: [] });
    if (path in empty) return json(empty[path]);
    unexpected.push(path); return json({ message: `Unexpected fixture request: ${path}` }, 500);
  });
  await page.goto('/');
  await page.getByTestId('login-email').fill('reports@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
  await page.goto('/#/rep');
  await expect(page.getByRole('heading', { name: 'Reportes', exact: true })).toBeVisible();
  if (scenario === 'normal') await expect(page.locator('.gamount')).toHaveText('$ 19.320.000');
  await page.evaluate(() => document.fonts.ready);
  return unexpected;
}
