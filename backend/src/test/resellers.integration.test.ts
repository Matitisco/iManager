import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { currentPeriodKey, nextPeriod } from '../modules/commissions/commission-math.js';

const { getApp } = useIntegrationApp();
const headers = () => buildAuthHeaders();
const directory = '/api/commissions/resellers';
async function add(name = 'Diego Ejemplo') {
  const r = await getApp().inject({ method: 'POST', url: directory, headers: headers(), payload: { name } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().reseller as { id: string; name: string };
}
async function sell(resellerId: string, extra: Record<string, unknown> = {}) {
  const r = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: headers(), payload: { resellerId, sellerMemberId: null, date: '15/01/2026', deviceLabel: 'Equipo ficticio', amount: 1000, currency: 'ARS', exchangeRate: 1000, ...extra } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().sale;
}
async function person(id: string, period = '2026-01', actor = headers()) {
  const r = await getApp().inject({ url: `/api/commissions/members/reseller:${id}?period=${period}`, headers: actor });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().person;
}
async function rule(extra: Record<string, unknown> = {}) {
  const r = await getApp().inject({ method: 'POST', url: '/api/commissions/rules', headers: headers(), payload: { rate: 10, basis: 'SALE_PERCENT', effectiveFrom: '2025-01-01', ...extra } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().rule;
}
async function pay(resellerId: string, extra: Record<string, unknown> = {}) {
  const r = await getApp().inject({ method: 'POST', url: '/api/commissions/payments', headers: headers(), payload: { resellerId, period: '2026-01', amount: 40, currency: 'ARS', settlesCurrency: 'ARS', exchangeRate: 1000, ...extra } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().payment;
}

describe('revendedores por tienda y comisiones', () => {
  it('el despliegue idempotente conserva datos viejos y agrega CHECKs para ambos beneficiarios', async () => {
    const f = await seedStoreContext();
    const legacy = await prisma.commissionPayment.create({ data: { storeId: f.store!.id, memberId: f.membership!.id, period: '2026-01', amount: 10, currency: 'ARS', settlesCurrency: 'ARS', exchangeRate: 1000, createdBy: f.user.id } });
    const startup = readFileSync(new URL('../../prisma/pre-push.sql', import.meta.url), 'utf8').split('-- #746:')[1];
    const sql = startup.slice(startup.indexOf('DO $$'));
    await prisma.$executeRawUnsafe(sql);
    await prisma.$executeRawUnsafe(sql);
    expect(await prisma.commissionPayment.findUnique({ where: { id: legacy.id } })).toEqual(legacy);
    const r = await add();
    await expect(prisma.commissionPayment.create({ data: { storeId: f.store!.id, period: '2026-01', amount: 10, currency: 'ARS', settlesCurrency: 'ARS', exchangeRate: 1000, createdBy: f.user.id } })).rejects.toThrow();
    await expect(prisma.commissionPayment.update({ where: { id: legacy.id }, data: { resellerId: r.id } })).rejects.toThrow();
    await expect(prisma.commissionRule.create({ data: { storeId: f.store!.id, memberId: f.membership!.id, resellerId: r.id, rate: 10, effectiveFrom: new Date(), createdBy: f.user.id } })).rejects.toThrow();
  });

  it('crea, normaliza, renombra y archiva sin crear usuarios ni membresías', async () => {
    const f = await seedStoreContext();
    const before = await prisma.storeMember.count();
    const reseller = await add(' Diego   Ejemplo ');
    expect(reseller.name).toBe('Diego Ejemplo');
    expect(await prisma.storeMember.count()).toBe(before);
    expect((await getApp().inject({ method: 'POST', url: directory, headers: headers(), payload: { name: 'diego ejemplo' } })).statusCode).toBe(409);
    const renamed = await getApp().inject({ method: 'PATCH', url: `${directory}/${reseller.id}`, headers: headers(), payload: { name: 'Sofía Ejemplo' } });
    expect(renamed.json().reseller.name).toBe('Sofía Ejemplo');
    const other = await seedStoreContext({ firebaseUid: 'otra-tienda', email: 'otra@example.com' });
    const foreign = await prisma.storeReseller.create({ data: { storeId: other.store!.id, name: 'Sofía Ejemplo' } });
    expect((await getApp().inject({ method: 'PATCH', url: `${directory}/${foreign.id}`, headers: headers(), payload: { archived: true } })).statusCode).toBe(404);
    const listed = await getApp().inject({ url: directory, headers: headers() });
    expect(listed.json().resellers.map((row: { id: string }) => row.id)).toEqual([reseller.id]);
    expect((await getApp().inject({ url: `/api/commissions/members/reseller:${foreign.id}`, headers: headers() })).statusCode).toBe(404);
    expect(await prisma.storeReseller.count({ where: { storeId: f.store!.id } })).toBe(1);
  });

  it('aplica XOR y aislamiento en creación, edición, reglas, pagos y asignación masiva', async () => {
    const f = await seedStoreContext();
    const r = await add();
    const other = await seedStoreContext({ firebaseUid: 'otro', email: 'otro@example.com' });
    const foreign = await prisma.storeReseller.create({ data: { storeId: other.store!.id, name: 'Ajeno' } });
    for (const payload of [{ resellerId: r.id, sellerMemberId: f.membership!.id }, { resellerId: foreign.id }]) {
      const response = await getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: headers(), payload: { amount: 100, deviceLabel: 'Falso', ...payload } });
      expect(response.statusCode).toBe(payload.sellerMemberId ? 400 : 404);
    }
    expect(await prisma.sale.count({ where: { storeId: f.store!.id } })).toBe(0);
    const sale = await sell(r.id);
    for (const url of [`/api/operations/sales/sales/${sale.id}`, `/api/sales/${sale.id}`]) {
      expect((await getApp().inject({ method: 'PATCH', url, headers: headers(), payload: { sellerMemberId: f.membership!.id } })).statusCode).toBe(400);
    }
    expect((await getApp().inject({ method: 'PATCH', url: '/api/commissions/sales/seller', headers: headers(), payload: { saleIds: [sale.id], sellerMemberId: f.membership!.id, resellerId: r.id } })).statusCode).toBe(400);
    for (const resource of ['rules', 'payments']) {
      const payload = resource === 'rules' ? { rate: 10, effectiveFrom: '2025-01-01' } : { period: '2026-01', amount: 10, currency: 'ARS', settlesCurrency: 'ARS', exchangeRate: 1000 };
      expect((await getApp().inject({ method: 'POST', url: `/api/commissions/${resource}`, headers: headers(), payload: { ...payload, resellerId: foreign.id } })).statusCode).toBe(404);
      expect((await getApp().inject({ method: 'POST', url: `/api/commissions/${resource}`, headers: headers(), payload: { ...payload, resellerId: r.id, memberId: f.membership!.id } })).statusCode).toBe(400);
    }
  });

  it('genera devengamientos, prioriza regla personal y liquida separado por beneficiario/moneda', async () => {
    await seedStoreContext();
    const a = await add(); const b = await add('Sofía Ejemplo');
    await rule(); await rule({ resellerId: a.id, rate: 20 });
    await sell(a.id); await sell(a.id, { currency: 'USD' }); await sell(b.id);
    expect((await person(a.id)).earned).toEqual({ ARS: 200, USD: 200 });
    expect((await person(b.id)).earned).toEqual({ ARS: 100, USD: 0 });
    const payment = await pay(a.id, { amount: 50 });
    await pay(a.id, { amount: 0.05, currency: 'USD', settlesCurrency: 'ARS' });
    expect(payment).toMatchObject({ memberId: null, resellerId: a.id });
    expect((await person(a.id)).pending).toEqual({ ARS: 100, USD: 200 });
    expect((await person(b.id)).paid.ARS).toBe(0);
    expect((await person(a.id, '2026-02')).previousBalance).toEqual({ ARS: 100, USD: 200 });
    const summary = await getApp().inject({ url: '/api/commissions?period=2026-01', headers: headers() });
    expect(summary.json().summary).toMatchObject({ salesCount: 3, unassignedSalesCount: 0 });
    const report = await getApp().inject({ url: '/api/reports/commissions?from=2026-01&to=2026-01', headers: headers() });
    expect(report.json().rows).toEqual(expect.arrayContaining([expect.objectContaining({ resellerId: a.id, memberId: null, name: a.name, role: 'RESELLER' })]));
    const payments = await getApp().inject({ url: `/api/commissions/payments?resellerId=${a.id}`, headers: headers() });
    expect(payments.json().payments).toHaveLength(2);
  });

  it.each(['cancelar', 'eliminar'])('%s una venta pagada conserva un ajuste solo para ese revendedor', async action => {
    const f = await seedStoreContext();
    const a = await add(); const b = await add('Otro Ejemplo');
    await rule(); const sale = await sell(a.id); await sell(b.id); await pay(a.id);
    if (action === 'cancelar') {
      const response = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${sale.id}/cancel`, headers: headers(), payload: {} });
      expect(response.statusCode, response.body).toBe(200);
    } else {
      const response = await getApp().inject({ method: 'DELETE', url: `/api/sales/${sale.id}`, headers: headers() });
      expect(response.statusCode, response.body).toBe(204);
    }
    const period = nextPeriod(currentPeriodKey());
    const detail = await person(a.id, period);
    expect(detail.adjustments).toEqual([expect.objectContaining({ label: 'A descontar', amount: -40 })]);
    expect((await person(b.id, period)).adjustments).toHaveLength(0);
  });

  it('reasigna en masa a otro revendedor, conserva el ajuste pagado y no duplica snapshots al reintentar', async () => {
    const f = await seedStoreContext(); const a = await add(); const b = await add('Otro Ejemplo'); await rule();
    const sale = await sell(a.id); await pay(a.id);
    const assign = () => getApp().inject({ method: 'PATCH', url: '/api/commissions/sales/seller', headers: headers(), payload: { saleIds: [sale.id], sellerMemberId: null, resellerId: b.id } });
    const changed = await assign(); expect(changed.statusCode, changed.body).toBe(200);
    expect((await person(b.id)).earned.ARS).toBe(100);
    expect((await person(a.id, nextPeriod(currentPeriodKey()))).adjustments).toEqual([expect.objectContaining({ amount: -40 })]);
    expect((await assign()).statusCode).toBe(200);
    expect(await prisma.commissionAccrual.count({ where: { storeId: f.store!.id, sourceSaleId: sale.id, resellerId: b.id, voidedAt: null } })).toBe(1);
  });

  it('archiva con ventas: conserva historial, permite liquidar y editar sin reasignar', async () => {
    const f = await seedStoreContext();
    const r = await add(); await rule(); const sale = await sell(r.id);
    const archived = await getApp().inject({ method: 'PATCH', url: `${directory}/${r.id}`, headers: headers(), payload: { archived: true } });
    expect(archived.json().reseller.archivedAt).toBeTruthy();
    expect((await getApp().inject({ method: 'POST', url: '/api/sales', headers: headers(), payload: { resellerId: r.id, date: '15/01/2026', deviceLabel: 'Falso', amount: 10, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' } })).statusCode).toBe(404);
    const edit = await getApp().inject({ method: 'PATCH', url: `/api/operations/sales/sales/${sale.id}`, headers: headers(), payload: { paymentMethod: 'TRANSFERENCIA' } });
    expect(edit.statusCode, edit.body).toBe(200);
    expect(edit.json().sale.resellerId).toBe(r.id);
    await pay(r.id);
    expect((await person(r.id)).pending.ARS).toBe(60);
    expect(await prisma.sale.count({ where: { storeId: f.store!.id, resellerId: r.id } })).toBe(1);
  });

  it('respeta permisos de Ventas y Comisiones; Mis comisiones nunca incluye externos', async () => {
    const f = await seedStoreContext(); const r = await add(); await rule(); await sell(r.id);
    const staff = await seedStoreContext({ firebaseUid: 'staff', email: 'staff@example.com', createStore: false });
    const member = await prisma.storeMember.create({ data: { storeId: f.store!.id, userId: staff.user.id, role: 'MANAGER', sections: ['sales', 'commissions'], isDefault: true } });
    const h = buildAuthHeaders({ uid: 'staff', email: 'staff@example.com' });
    const allowed = await getApp().inject({ method: 'POST', url: directory, headers: h, payload: { name: 'Nuevo Ejemplo' } });
    expect(allowed.statusCode).toBe(201);
    const detail = await person(r.id, '2026-01', h);
    expect(detail.sales[0]).not.toHaveProperty('cost'); expect(detail.sales[0]).not.toHaveProperty('grossProfit');
    const mine = await getApp().inject({ url: '/api/commissions/mine?period=2026-01', headers: h });
    expect(mine.json().person).toMatchObject({ memberId: member.id, resellerId: null, salesCount: 0 });
    await prisma.storeMember.update({ where: { id: member.id }, data: { sections: ['clients'] } });
    expect((await getApp().inject({ method: 'PATCH', url: `${directory}/${r.id}`, headers: h, payload: { archived: true } })).statusCode).toBe(403);
    expect((await getApp().inject({ method: 'POST', url: directory, headers: h, payload: { name: 'Prohibido' } })).statusCode).toBe(403);
    expect((await getApp().inject({ url: `/api/commissions/members/reseller:${r.id}`, headers: h })).statusCode).toBe(403);
  });

  it('conserva revendedor al confirmar un canje pendiente y requestKey evita duplicar comisión', async () => {
    const f = await seedStoreContext(); const stock = await seedCatalogFixture(f.store!.id); const r = await add(); await rule();
    const payload = { draft: true, resellerId: r.id, clientId: stock.client.id, amount: 1000, currency: 'ARS', deviceLabel: 'Falso', tradeIn: { deviceReceived: 'Recibido ficticio', takeValue: 200 } };
    const draft = await getApp().inject({ method: 'POST', url: '/api/operations/tradeins', headers: headers(), payload });
    expect(draft.statusCode, draft.body).toBe(201);
    const confirmed = await getApp().inject({ method: 'POST', url: `/api/operations/tradeins/trades/${draft.json().tradeIn.id}/confirm`, headers: headers(), payload: {} });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().sale).toMatchObject({ resellerId: r.id, sellerMemberId: null });
    const a = await sell(r.id, { requestKey: 'reseller-idempotent' });
    const b = await sell(r.id, { requestKey: 'reseller-idempotent' });
    expect(a.id).toBe(b.id);
    expect(await prisma.commissionAccrual.count({ where: { storeId: f.store!.id, sourceSaleId: a.id, voidedAt: null } })).toBe(1);
  });
});
