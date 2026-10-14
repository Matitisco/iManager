import { expect, type Page } from '@playwright/test';
import { data, me } from '../pwa/fixtures.mjs';
import { commissionFixturePeople, commissionFixturePeriod, commissionFixtureRules, commissionFixtureSummary } from '../../src/test/commission-fixtures';
import type { CommissionPaymentInput, CommissionRuleInput } from '../../src/types/commissions';

export async function mockCommissions(page: Page) {
  page.on('pageerror', error => { throw error; });
  const people = structuredClone(commissionFixturePeople);
  const rules = structuredClone(commissionFixtureRules);
  const state = { resetPayments: () => { people.splice(0, people.length, ...structuredClone(commissionFixturePeople)); }, staff: false, reports: true, payments: [] as CommissionPaymentInput[], rules: [] as CommissionRuleInput[], assignments: [] as { saleIds: string[]; sellerMemberId: string | null }[], createdSales: [] as Record<string, unknown>[], editedSales: [] as Record<string, unknown>[], calls: [] as string[] };
  const sellers = [{ id: 'owner', name: 'Usuario Ejemplo', role: 'OWNER' }, { id: 'lucia', name: 'Lucía Díaz', role: 'MANAGER' }, { id: 'sofia', name: 'Sofía Pérez', role: 'STAFF' }, { id: 'martin', name: 'Martín Gómez', role: 'STAFF' }];
  const members = sellers.map(seller => ({ id: seller.id, userId: `${seller.id}-user`, role: seller.role, isDefault: true, createdAt: '2026-10-01T12:00:00Z', sections: seller.id === 'lucia' ? ['dashboard', 'inventory', 'sales', 'tradeins', 'clients', 'reports', 'commissions', 'notifications'] : null, user: { id: `${seller.id}-user`, displayName: seller.name, email: `${seller.id}@ejemplo.com`, avatarUrl: null } }));
  const sales = [
    ['158', 'Juan Ruiz', 'iPhone 15 · 128GB', 'sofia', 1300000, 'ARS', 'COMPLETADA'],
    ['157', 'Carla Méndez', 'iPhone 13 · 128GB', 'martin', 520, 'USD', 'COMPLETADA'],
    ['156', 'Diego Sosa', 'iPhone 14 Pro · 256GB', null, 1150, 'USD', 'PENDIENTE'],
    ['155', 'Ana Torres', 'iPhone 12 · 64GB', null, 650000, 'ARS', 'COMPLETADA'],
    ['154', 'Pablo Ríos', 'iPhone 15 Pro · 256GB', null, 1350, 'USD', 'COMPLETADA'],
    ['153', 'Laura Gil', 'iPhone 13 mini · 128GB', 'sofia', 900000, 'ARS', 'CANCELADA'],
  ].map(([number, buyer, equipment, seller, amount, currency, status]) => ({ id: `sale-${number}`, saleNumber: Number(number), clientId: '', clientName: buyer, productId: '', deviceLabel: equipment, sellerMemberId: seller, amount, amountCurrency: currency, status, paymentMethod: 'TRANSFERENCIA', date: '2026-10-13', integratedOperation: true }));
  const inventory = [{ ...data.inventory[0], id: 'product-15', model: 'iPhone 15', capacity: '128GB', color: 'Negro', price: 1300000, cost: 940000, status: 'DISPONIBLE' }];
  await page.clock.setFixedTime(new Date('2026-10-13T18:30:00-03:00'));
  await page.addInitScript(() => {
    localStorage.setItem('imanager:install-dismissed:ios', 'yes');
    localStorage.setItem('imanager:install-dismissed:android', 'yes');
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query.includes('display-mode: standalone') ? Object.defineProperty(original(query), 'matches', { value: true }) : original(query);
  });
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300, fechaActualizacion: '2026-10-13T21:30:00Z' } }));
  await page.route('https://api.bluelytics.com.ar/**', route => route.fulfill({ json: {} }));
  await page.route('https://mercados.ambito.com/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; state.calls.push(path);
    const json = async (value: unknown, status = 200) => route.fulfill({ json: value, status });
    if (path === '/api/me') return json({ ...me, user: { ...me.user, id: state.staff ? 'sofia-user' : 'owner-user', displayName: state.staff ? 'Sofía Pérez' : 'Usuario Ejemplo' }, store: { ...me.store, id: 'commission-store', name: 'Mi Tienda Ejemplo' }, membership: { role: state.staff ? 'STAFF' : 'OWNER', sections: state.staff ? ['dashboard', 'inventory', 'sales', 'tradeins', 'clients', 'notifications'] : null, isDefault: true } });
    if (path === '/api/commissions/exchange-rate') return json({ exchangeRate: 1300 });
    if (path === '/api/commissions/sellers') return json({ sellers });
    if (path === '/api/commissions/mine') { const person = structuredClone(people[0]); person.sales = person.sales.map(({ cost: _cost, grossProfit: _profit, takeValue: _take, ...sale }) => sale); return json({ period: commissionFixturePeriod, person }); }
    if (state.staff && (path.startsWith('/api/commissions') || path === '/api/reports/commissions')) return json({ error: 'No tenés acceso a Comisiones' }, 403);
    if (path === '/api/commissions') return json({ ...commissionFixtureSummary, people: people.map(({ sales: _sales, payments: _payments, adjustments: _adjustments, ...person }) => person) });
    if (path.startsWith('/api/commissions/members/')) { const person = structuredClone(people.find(p => path.endsWith(p.memberId))!); if (!state.reports) person.sales = person.sales.map(({ cost: _cost, grossProfit: _profit, takeValue: _take, ...sale }) => sale); return json({ period: commissionFixturePeriod, person }); }
    if (path === '/api/commissions/rules' && request.method() === 'POST') { const body = request.postDataJSON(); state.rules.push(body); return json({ rule: { ...body, id: 'new-rule' } }, 201); }
    if (path === '/api/commissions/rules') return json({ rules });
    if (path === '/api/commissions/payments') { const body = request.postDataJSON() as CommissionPaymentInput; state.payments.push(body); const person = people.find(p => p.memberId === body.memberId)!; const settledAmount = body.currency === body.settlesCurrency ? body.amount : body.currency === 'USD' ? body.amount * body.exchangeRate : body.amount / body.exchangeRate; person.pending[body.settlesCurrency] -= settledAmount; person.paid[body.settlesCurrency] += settledAmount; const payment = { ...body, id: `payment-${state.payments.length}`, createdAt: '2026-10-13T21:30:00Z', createdBy: 'owner', storeId: 'commission-store', settledAmount }; person.payments.push(payment); return json({ payment }, 201); }
    if (path === '/api/commissions/sales/seller') { const body = request.postDataJSON(); state.assignments.push(body); sales.forEach(sale => { if (body.saleIds.includes(sale.id)) sale.sellerMemberId = body.sellerMemberId; }); return json({ updated: body.saleIds.length }); }
    if (path === '/api/reports/commissions') return json({ from: url.searchParams.get('from'), to: url.searchParams.get('to'), rows: people.map(person => ({ ...person, period: '2026-10' })) });
    if (path.endsWith('/members')) return json({ members });
    if (path.includes('/members/') && request.method() === 'PATCH') { const member = members.find(m => path.includes(m.id))!; return json({ member: { ...member, ...request.postDataJSON() } }); }
    if (path.startsWith('/api/operations/sales/sales/') && request.method() === 'PATCH') {
      const body = request.postDataJSON(); state.editedSales.push(body);
      const sale = sales.find(item => path.endsWith(item.id))!; Object.assign(sale, body);
      return json({ sale, inventory: [], clients: [], notifications: [], summary: 'Venta actualizada' });
    }
    if (path === '/api/operations/sales/options') return json({ products: inventory, clients: [{ ...data.clients[0], id: 'client-juan', name: 'Juan Ruiz' }] });
    if (path === '/api/operations/sales' && request.method() === 'POST') { state.createdSales.push(request.postDataJSON()); return json({ sale: { ...sales[0], id: 'new-sale', saleNumber: 159, ...request.postDataJSON() }, inventory: [], clients: [], notifications: [], summary: 'Venta registrada' }, 201); }
    return json({ ...data, inventory, clients: [{ ...data.clients[0], id: 'client-juan', name: 'Juan Ruiz' }], sales, members, invitations: [], tradeIns: [], drafts: [] });
  });
  await page.goto('/');
  await page.getByTestId('login-email').fill('pwa.owner@imanager.test');
  await page.getByTestId('login-password').fill('test123456');
  await page.getByTestId('login-submit').click();
  await expect(page.locator('.desk-app')).toBeVisible();
  return state;
}
