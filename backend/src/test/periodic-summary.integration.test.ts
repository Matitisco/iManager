import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
import { getPeriodicSummary } from '../modules/reports/periodic-summary.service.js';

const { getApp } = useIntegrationApp();
const url = '/api/reports/periodic-summary?period=month:2024-02';
const at = new Date('2024-02-20T15:00:00Z');
const read = (uid = 'test-owner', path = url) => getApp().inject({ method: 'GET', url: path, headers: buildAuthHeaders({ uid }) });

async function addSale(storeId: string, patch: Record<string, unknown> = {}) {
  return prisma.sale.create({ data: { storeId, dateLabel: '20/02/2024', soldAt: at, amount: 100, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', deviceLabel: 'iPhone 13', ...patch } });
}

describe('periodic summary read-only API', () => {
  it('scopes the entire breakdown to the tenant, excludes voids and preserves currency totals', async () => {
    const owner = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.local' });
    const storeId = owner.store!.id;
    await addSale(storeId, { amount: 100.25 });
    await addSale(storeId, { amount: 10, amountCurrency: 'USD' });
    await addSale(storeId, { amount: 20, status: 'PENDIENTE' });
    for (const patch of [{ status: 'CANCELADA' }, { status: 'ANULADA' }, { voidedAt: at }, { cancelledAt: at }]) await addSale(storeId, { amount: 9000, ...patch });
    await addSale(other.store!.id, { deviceLabel: 'Foreign sale', amount: 80000 });
    const before = await prisma.sale.findMany({ orderBy: { id: 'asc' } });
    const response = await read();
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.sales.total).toEqual(expect.arrayContaining([{ amount: 120.25, currency: 'ARS' }, { amount: 10, currency: 'USD' }]));
    expect(data.sales.items).toHaveLength(7);
    expect(data.sales.items.filter((row: { voided: boolean }) => row.voided)).toHaveLength(4);
    expect(JSON.stringify(data)).not.toContain('Foreign sale');
    expect(await prisma.sale.findMany({ orderBy: { id: 'asc' } })).toEqual(before);
  });

  it('uses inclusive calendar business dates and store-local timestamp boundaries', async () => {
    const { store } = await seedStoreContext();
    await addSale(store!.id, { dateLabel: '2024-02-01', amount: 1 });
    await addSale(store!.id, { dateLabel: '29/02/2024', amount: 2 });
    await addSale(store!.id, { dateLabel: '2024-01-31', amount: 1000 });
    await addSale(store!.id, { dateLabel: '2024-03-01', amount: 1000 });
    await addSale(store!.id, { dateLabel: '', soldAt: new Date('2024-03-01T02:59:59.999Z'), amount: 4 });
    await addSale(store!.id, { dateLabel: '', soldAt: new Date('2024-03-01T03:00:00Z'), amount: 1000 });
    expect((await read()).json().sales.total).toEqual([{ currency: 'ARS', amount: 7 }]);
    const half = await read('test-owner', '/api/reports/periodic-summary?period=half:2024-02-01');
    expect(half.json().sales.total).toEqual([{ currency: 'ARS', amount: 1 }]);
  });

  it('includes open RMA with no money and settled refunds/credits by resolution day; omits voided claims', async () => {
    const { store } = await seedStoreContext();
    const base = { storeId: store!.id, reason: 'Defect', openedAt: new Date('2024-01-01T12:00:00Z'), deviceLabel: 'Phone', moneyCurrency: 'USD' };
    await prisma.returnCase.createMany({ data: [
      { ...base, caseNumber: 1, resolvedAt: at, settlement: 'REINTEGRO', moneyAmount: 180, status: 'RESUELTO' },
      { ...base, caseNumber: 2, resolvedAt: at, settlement: 'NOTA_CREDITO', moneyAmount: 100, status: 'RESUELTO' },
      { ...base, caseNumber: 3, openedAt: at, rmaStatus: 'ENVIADO', status: 'EN_PROVEEDOR', moneyAmount: 999 },
      { ...base, caseNumber: 4, resolvedAt: at, settlement: 'REINTEGRO', moneyAmount: 800, status: 'ANULADO' },
      { ...base, caseNumber: 5, resolvedAt: at, settlement: 'REINTEGRO', moneyAmount: 800, deletedAt: at },
      { ...base, caseNumber: 6, openedAt: at, resolvedAt: new Date('2024-03-01T15:00:00Z'), settlement: 'REINTEGRO', moneyAmount: 900 },
    ] });
    const data = (await read()).json();
    expect(data.returns.total).toEqual([{ currency: 'USD', amount: 280 }]);
    expect(data.returns.items).toHaveLength(3);
    expect(data.returns.items.find((row: { pending: boolean }) => row.pending)).toMatchObject({ amount: 0, title: 'Phone · RMA', pending: true });
  });

  it('keeps a supplier RMA refund in its settlement period even after the supplier finishes', async () => {
    const { store } = await seedStoreContext();
    const claim = await prisma.returnCase.create({ data: {
      storeId: store!.id, caseNumber: 1, reason: 'Defect', openedAt: new Date('2024-01-01T12:00:00Z'),
      deviceLabel: 'Phone', settlement: 'REINTEGRO', moneyAmount: 180, moneyCurrency: 'USD', status: 'EN_PROVEEDOR', rmaStatus: 'ENVIADO',
      events: { create: { storeId: store!.id, status: 'EN_PROVEEDOR', createdAt: at } },
    } });
    expect((await read()).json().returns.total).toEqual([{ currency: 'USD', amount: 180 }]);
    await prisma.returnCase.update({ where: { id: claim.id }, data: {
      status: 'RESUELTO', rmaStatus: 'RECIBIDO', resolvedAt: new Date('2024-03-05T15:00:00Z'),
      events: { create: { storeId: store!.id, status: 'RESUELTO', createdAt: new Date('2024-03-05T15:00:00Z') } },
    } });
    expect((await read()).json().returns.total).toEqual([{ currency: 'USD', amount: 180 }]);
    expect((await read('test-owner', '/api/reports/periodic-summary?period=month:2024-03')).json().returns.items).toEqual([]);
  });

  it('uses immutable closed snapshots, counts each discrepant device once, and excludes open/foreign counts', async () => {
    const owner = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@test.local' });
    const result = { matched: [], missing: [{ imei: '111', model: 'Historical phone', capacity: '128GB' }], surplus: [{ imei: '222', model: '', capacity: '' }], sold: [{ imei: '333', note: 'Se vendió durante el conteo' }], excludedNoImei: 4 };
    const base = { storeId: owner.store!.id, startedById: owner.user.id, startedByName: 'Owner', status: 'CLOSED', closedAt: at, result };
    await prisma.stockCount.create({ data: base });
    await prisma.stockCount.create({ data: { ...base, closedAt: new Date('2024-02-25T15:00:00Z'), result: { ...result, missing: [], surplus: [{ imei: '111', model: 'Latest discrepancy', capacity: '' }, { imei: '444', model: '', capacity: '' }] } } });
    await prisma.stockCount.create({ data: { ...base, status: 'OPEN', closedAt: null } });
    await prisma.stockCount.create({ data: { ...base, storeId: other.store!.id, result: { ...result, missing: [{ imei: '999', model: 'Foreign device' }] } } });
    await prisma.stockCount.create({ data: { ...base, closedAt: new Date('2024-03-01T03:00:00Z') } });
    const data = (await read()).json();
    expect(data.stock).toMatchObject({ count: 3, counts: 2, latestDay: '2024-02-25' });
    expect(data.stock.items.find((row: { imei: string }) => row.imei === '111')).toMatchObject({ title: 'Latest discrepancy', status: 'Sobra' });
    expect(JSON.stringify(data)).not.toContain('Foreign device');
    expect(JSON.stringify(data.stock)).not.toContain('333');
  });

  it('enforces report/module permissions and does not leak blind count results to staff', async () => {
    const { store, membership } = await seedStoreContext({ role: 'STAFF' });
    await addSale(store!.id);
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { sections: ['sales', 'inventory'] } });
    expect((await read()).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { sections: ['reports', 'inventory'] } });
    const limited = (await read()).json();
    expect(limited).toMatchObject({ sales: null, returns: null, stock: null });
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { sections: ['reports', 'sales', 'inventory'] } });
    expect((await read()).json()).toMatchObject({ sales: { items: [expect.objectContaining({ title: 'iPhone 13' })] }, stock: null });
    expect((await getApp().inject({ method: 'GET', url })).statusCode).toBe(401);
  });

  it('rejects invalid/ongoing ranges and returns honest empty states', async () => {
    const { store } = await seedStoreContext();
    for (const period of ['half:2024-02-15', 'month:2024-13', 'month:9999-12']) expect((await read('test-owner', `/api/reports/periodic-summary?period=${period}`)).statusCode).toBe(400);
    const data = (await read()).json();
    expect(data).toMatchObject({ sales: { total: [], items: [] }, returns: { total: [], items: [] }, stock: { count: 0, counts: 0, items: [] } });
    const latest = await getPeriodicSummary(store!.id, { role: 'OWNER' }, 'latest-half', new Date('2026-10-16T02:59:59Z'));
    expect(latest.period).toMatchObject({ from: '2026-09-16', to: '2026-09-30' });
  });
});
