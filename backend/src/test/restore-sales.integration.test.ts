import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';

const { getApp } = useIntegrationApp();
const headers = buildAuthHeaders();
const post = (url: string, payload = {}, auth: Record<string, string> = headers) => getApp().inject({ method: 'POST', url, headers: auth, payload });
const restore = (id: string, auth: Record<string, string> = headers) => post(`/api/sales/${id}/restore`, {}, auth);
const voidSale = (id: string) => post(`/api/operations/sales/sales/${id}/void`);

async function fixture(input: Record<string, unknown> = {}) {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  const catalog = await seedCatalogFixture(storeId);
  await prisma.client.update({ where: { id: catalog.client.id }, data: { pendingBalance: 50 } });
  const created = await post('/api/operations/sales', { clientId: catalog.client.id, productId: catalog.inventoryItem.id, amount: 1200, currency: 'ARS', exchangeRate: 1000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', ...input });
  expect(created.statusCode, created.body).toBe(201);
  return { ...catalog, ...created.json(), storeId, owner };
}

async function state(storeId: string) {
  const [sales, stock, clients, trades, cash, deposits, commissions, payments] = await Promise.all([
    prisma.sale.findMany({ where: { storeId }, orderBy: { id: 'asc' } }),
    prisma.inventoryItem.findMany({ where: { storeId }, orderBy: { id: 'asc' } }),
    prisma.client.findMany({ where: { storeId }, orderBy: { id: 'asc' } }),
    prisma.tradeIn.findMany({ where: { storeId }, orderBy: { id: 'asc' } }),
    prisma.cashMovement.aggregate({ where: { storeId }, _sum: { amount: true } }),
    prisma.clientDeposit.findMany({ where: { storeId, status: { in: ['CREDIT', 'ACTIVE', 'APPLIED'] } }, orderBy: { id: 'asc' } }),
    prisma.commissionAccrual.findMany({ where: { storeId, voidedAt: null }, orderBy: { id: 'asc' } }),
    prisma.clientPayment.groupBy({ by: ['kind'], where: { storeId }, _sum: { amount: true }, orderBy: { kind: 'asc' } }),
  ]);
  return {
    sales: sales.map(row => ({ id: row.id, status: row.status, open: String(row.openBalance), voided: row.voidedAt })),
    stock: stock.map(row => ({ id: row.id, status: row.status, pending: row.pendingSaleRegistration, archived: row.archivedAt })),
    clients: clients.map(row => ({ id: row.id, total: String(row.totalSpent), debt: String(row.pendingBalance), last: row.lastPurchaseAt })),
    trades: trades.map(row => ({ id: row.id, status: row.status, confirmation: row.confirmationStatus, voided: row.voidedAt })),
    cash: String(cash._sum.amount ?? 0),
    deposits: deposits.map(row => ({ id: row.id, status: row.status, saleId: row.saleId, applied: String(row.appliedAmount) })),
    commissions,
    payments: payments.filter(row => Number(row._sum.amount) !== 0).map(row => ({ kind: row.kind, amount: String(row._sum.amount) })),
  };
}

describe('restore annulled sales', () => {
  it.each([
    { status: 'COMPLETADA', trade: false, partial: false },
    { status: 'PENDIENTE', trade: false, partial: false },
    { status: 'COMPLETADA', trade: true, partial: false },
    { status: 'PENDIENTE', trade: true, partial: false },
    { status: 'COMPLETADA', trade: false, partial: true },
  ])('restores exact effects and supports repeated cycles ($status, trade $trade, partial $partial)', async ({ status, trade, partial }) => {
    const f = await fixture({ status, ...(trade ? { tradeIn: { deviceReceived: 'iPhone 11', takeValue: 400 } } : {}), ...(partial ? { tenders: [{ amount: 300, currency: 'ARS', method: 'EFECTIVO' }] } : {}) });
    if (status === 'PENDIENTE') expect((await post(`/api/clients/${f.client.id}/payments`, { amount: 300, method: 'EFECTIVO' })).statusCode).toBe(201);
    const before = await state(f.storeId);
    for (let cycle = 0; cycle < 2; cycle++) {
      expect((await voidSale(f.sale.id)).statusCode).toBe(200);
      const response = await restore(f.sale.id);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().sale).not.toHaveProperty('cancellationSnapshot');
      expect(await state(f.storeId)).toEqual(before);
      const repeated = await Promise.all([restore(f.sale.id), restore(f.sale.id)]);
      expect(repeated.map(row => row.statusCode)).toEqual([200, 200]);
      expect(await state(f.storeId)).toEqual(before);
    }
    expect(await prisma.auditEvent.count({ where: { entityId: f.sale.id, action: 'sale.restored' } })).toBe(2);
  });

  it('restores cash instruments and commission snapshots without rewriting their history', async () => {
    const f = await fixture();
    // Create another real sale with cash registers and a seller rule in effect.
    const box = await post('/api/cash', { name: 'Caja ARS', currency: 'ARS', method: 'EFECTIVO', opening: 0 });
    const boxId = box.json().id;
    expect((await post(`/api/cash/${boxId}/open`)).statusCode).toBe(200);
    await prisma.commissionRule.create({ data: { storeId: f.storeId, basis: 'SALE_PERCENT', rate: 10, createdBy: f.owner.user.id, effectiveFrom: new Date('2020-01-01') } });
    const sale = await post('/api/operations/sales', { clientId: f.client.id, deviceLabel: 'iPhone 15', amount: 1000, currency: 'ARS', exchangeRate: 1000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', sellerMemberId: f.owner.membership!.id });
    expect(sale.statusCode, sale.body).toBe(201);
    const id = sale.json().sale.id;
    const before = await state(f.storeId);
    expect((await voidSale(id)).statusCode).toBe(200);
    await prisma.commissionRule.updateMany({ where: { storeId: f.storeId }, data: { rate: 99 } });
    const responses = await Promise.all([restore(id), restore(id)]);
    expect(responses.map(row => row.statusCode)).toEqual([200, 200]);
    expect(await state(f.storeId)).toEqual(before);
    expect(Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id: boxId } })).balance)).toBe(1000);
    expect(await prisma.cashMovement.count({ where: { storeId: f.storeId, sourceId: id } })).toBe(3);
  });

  it('rejects a resale atomically and preserves unrelated client changes', async () => {
    const f = await fixture();
    await voidSale(f.sale.id);
    const resale = await post('/api/operations/sales', { productId: f.inventoryItem.id, amount: 1400, status: 'COMPLETADA' });
    expect(resale.statusCode, resale.body).toBe(201);
    const before = await state(f.storeId);
    expect((await restore(f.sale.id)).statusCode).toBe(409);
    expect(await state(f.storeId)).toEqual(before);
    await voidSale(resale.json().sale.id);
    await prisma.client.update({ where: { id: f.client.id }, data: { pendingBalance: { increment: 25 } } });
    expect((await restore(f.sale.id)).statusCode).toBe(200);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(75);
  });

  it.each([false, true])('re-applies deposits or rejects reused credit (reused %s)', async reused => {
    const f = await fixture();
    const deposit = await post(`/api/clients/${f.client.id}/deposits`, { amount: 100, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', requestKey: 'deposit-test' });
    expect(deposit.statusCode, deposit.body).toBe(201);
    const id = deposit.json().deposit?.id ?? deposit.json().id;
    const sale = await post('/api/operations/sales', { clientId: f.client.id, deviceLabel: 'iPhone 12', amount: 1000, currency: 'ARS', exchangeRate: 1000, status: 'COMPLETADA', depositIds: [id] });
    expect(sale.statusCode, sale.body).toBe(201);
    const before = await state(f.storeId);
    await voidSale(sale.json().sale.id);
    if (reused) await prisma.clientDeposit.update({ where: { id }, data: { status: 'APPLIED', saleId: f.sale.id } });
    const response = await restore(sale.json().sale.id);
    expect(response.statusCode, response.body).toBe(reused ? 409 : 200);
    if (!reused) expect(await state(f.storeId)).toEqual(before);
  });

  it('enforces membership, section, sensitive permissions, store scope and the dedicated restore route', async () => {
    const f = await fixture();
    await voidSale(f.sale.id);
    const staff = await prisma.user.create({ data: { firebaseUid: 'restore-staff', email: 'restore-staff@example.com' } });
    const member = await prisma.storeMember.create({ data: { storeId: f.storeId, userId: staff.id, role: 'STAFF', isDefault: true, sections: ['sales'], sensitiveAccess: false } });
    const staffAuth = buildAuthHeaders({ uid: staff.firebaseUid });
    expect((await restore(f.sale.id, staffAuth)).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: member.id }, data: { sensitiveAccess: true, sections: ['inventory'] } });
    expect((await restore(f.sale.id, staffAuth)).statusCode).toBe(403);
    const other = await seedStoreContext({ firebaseUid: 'other', email: 'other@example.com' });
    expect((await restore(f.sale.id, buildAuthHeaders({ uid: other.user.firebaseUid }))).statusCode).toBe(404);
    expect((await restore(f.sale.id, {})).statusCode).toBe(401);
    expect((await getApp().inject({ method: 'PATCH', url: `/api/sales/${f.sale.id}`, headers, payload: { status: 'COMPLETADA' } })).statusCode).toBe(409);
    await prisma.storeMember.update({ where: { id: member.id }, data: { sections: ['sales'] } });
    expect((await restore(f.sale.id, staffAuth)).statusCode).toBe(200);
  });

  it('restores an existing fully collected void and rejects ambiguous historical pending data', async () => {
    const f = await fixture();
    await voidSale(f.sale.id);
    await prisma.sale.update({ where: { id: f.sale.id }, data: { cancellationSnapshot: Prisma.DbNull } });
    expect((await restore(f.sale.id)).statusCode).toBe(200);
    await prisma.sale.update({ where: { id: f.sale.id }, data: { status: 'PENDIENTE' } });
    await prisma.clientPayment.deleteMany({ where: { saleId: f.sale.id } });
    await voidSale(f.sale.id);
    await prisma.sale.update({ where: { id: f.sale.id }, data: { cancellationSnapshot: Prisma.DbNull } });
    expect((await restore(f.sale.id)).statusCode).toBe(409);
  });

  it('rolls back stock and balances if a linked trade changed after cancellation', async () => {
    const f = await fixture({ tradeIn: { deviceReceived: 'iPhone 11', takeValue: 400 } });
    await voidSale(f.sale.id);
    await prisma.tradeIn.update({ where: { id: f.tradeIn.id }, data: { confirmationStatus: 'CONFIRMED' } });
    const before = await state(f.storeId);
    expect((await restore(f.sale.id)).statusCode).toBe(409);
    expect(await state(f.storeId)).toEqual(before);
  });

  it('preserves installment balances and schedules', async () => {
    const f = await fixture({ tenders: [{ amount: 300, currency: 'ARS', method: 'EFECTIVO' }], installments: { count: 3, frequency: 'MENSUAL', firstDueDate: '2026-11-10', collectFirstNow: false } });
    const installments = await prisma.saleInstallment.findMany({ where: { saleId: f.sale.id } });
    expect(installments).toHaveLength(3);
    const before = await state(f.storeId);
    await voidSale(f.sale.id);
    expect((await restore(f.sale.id)).statusCode).toBe(200);
    expect(await state(f.storeId)).toEqual(before);
    expect(await prisma.saleInstallment.findMany({ where: { saleId: f.sale.id } })).toEqual(installments);
  });
});
