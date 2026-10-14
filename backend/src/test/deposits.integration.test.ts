import { describe, expect, it } from 'vitest';
import { prisma } from '../plugins/prisma.js';
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from './db.js';
import { useIntegrationApp } from './integration-helpers.js';
const { getApp } = useIntegrationApp();
async function fixture() {
  const owner = await seedStoreContext();
  const rows = await seedCatalogFixture(owner.store!.id);
  return { ...rows, storeId: owner.store!.id, headers: buildAuthHeaders(), owner };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function deposit(f: Fixture, changes: Record<string, unknown> = {}) {
  const response = await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits`, headers: f.headers, payload: { amount: 100000, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', requestKey: crypto.randomUUID(), ...changes } });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().deposit as { id: string; amount: number; status: string };
}
function sale(f: Fixture, payload: Record<string, unknown> = {}) {
  return getApp().inject({ method: 'POST', url: '/api/operations/sales', headers: f.headers, payload: { clientId: f.client.id, productId: f.inventoryItem.id, amount: 500, currency: 'USD', exchangeRate: 2000, paymentMethod: 'EFECTIVO', status: 'PENDIENTE', ...payload } });
}
function cancel(f: Fixture, id: string, mode: 'REFUND' | 'CREDIT') {
  return getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits/${id}/cancel`, headers: f.headers, payload: { mode } });
}
describe('client deposits', () => {
  it('records a receipt, frozen quote, reservation metadata and audit, and replays without another collection', async () => {
    const f = await fixture();
    const input = { productId: f.inventoryItem.id, requestKey: 'same-receipt' };
    const row = await deposit(f, input); await deposit(f, input);
    const stored = await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } });
    expect(Number(stored.usdAmount)).toBe(100);
    expect(Number(stored.exchangeRate)).toBe(1000);
    expect(await prisma.clientPayment.count({ where: { clientId: f.client.id, kind: 'SENA' } })).toBe(1);
    expect(await prisma.inventoryItem.findUnique({ where: { id: f.inventoryItem.id } })).toMatchObject({ status: 'RESERVADO', reservedClientId: f.client.id, reservedClientName: f.client.name, reservedDepositId: row.id, reservedAt: expect.any(Date) });
    expect(await prisma.auditEvent.findFirst({ where: { action: 'deposit.created' } })).toMatchObject({ actorUserId: f.owner.user.id, entityId: f.client.id });
    const list = await getApp().inject({ url: `/api/inventory?skip=0&take=30`, headers: f.headers });
    expect(list.statusCode, list.body).toBe(200);
    expect(JSON.stringify(list.json())).toContain(f.client.name);
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).pendingBalance)).toBe(0);
  });
  it('does not reserve an item that already has an active deposit', async () => {
    const f = await fixture(); const row = await deposit(f, { productId: f.inventoryItem.id });
    const second = await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits`, headers: f.headers, payload: { amount: 1000, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', requestKey: crypto.randomUUID(), productId: f.inventoryItem.id } });
    expect(second.statusCode, second.body).toBe(409);
    expect(await prisma.inventoryItem.count({ where: { reservedDepositId: row.id } })).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).reservedDepositId).toBe(row.id);
  });
  it('blocks other buyers, legacy sales, manual release, imports, stock deletion and mismatched reserved application', async () => {
    const f = await fixture(); const row = await deposit(f, { productId: f.inventoryItem.id });
    const other = await prisma.client.create({ data: { storeId: f.storeId, name: 'Otra persona' } });
    expect((await sale(f, { clientId: other.id, depositIds: [row.id] })).statusCode).toBe(409);
    expect((await sale(f)).statusCode).toBe(409);
    expect((await getApp().inject({ method: 'POST', url: '/api/sales', headers: f.headers, payload: { clientId: other.id, productId: f.inventoryItem.id, amount: 500, date: '2026-10-14', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', exchangeRate: 1000 } })).statusCode).toBe(409);
    expect((await getApp().inject({ method: 'PATCH', url: `/api/inventory/${f.inventoryItem.id}`, headers: f.headers, payload: { status: 'DISPONIBLE' } })).statusCode).toBe(409);
    expect((await getApp().inject({ method: 'DELETE', url: `/api/inventory/${f.inventoryItem.id}`, headers: f.headers })).statusCode).toBe(409);
    const imported = await getApp().inject({ method: 'POST', url: '/api/inventory/import', headers: f.headers, payload: { rows: [{ imei: f.inventoryItem.imei, model: 'iPhone 14', price: 1200, status: 'DISPONIBLE' }] } });
    expect(imported.statusCode, imported.body).toBe(200); expect(imported.json().updated).toBe(0);
    expect((await sale(f, { productId: null, deviceLabel: 'Otro equipo', depositIds: [row.id] })).statusCode).toBe(409);
    expect(await prisma.sale.count()).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).status).toBe('RESERVADO');
  });
  it('applies the frozen USD value, preserves revenue, reduces debt and consumes once with sale request replay', async () => {
    const f = await fixture(); const row = await deposit(f, { productId: f.inventoryItem.id });
    const payload = { depositIds: [row.id], requestKey: 'sale-once' };
    const response = await sale(f, payload);
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().sale).toMatchObject({ amount: 500, depositAppliedAmount: 100 });
    expect(response.json().summary).toContain("deuda US$ 400");
    expect(response.json().clients[0]).toMatchObject({ pendingBalance: 400, totalSpent: 500 });
    expect(response.json().inventory[0]).toMatchObject({ status: 'VENDIDO', reservedClientId: null });
    expect((await sale(f, payload)).json().sale.id).toBe(response.json().sale.id);
    const reused = await sale(f, { productId: null, deviceLabel: 'Equipo 2', depositIds: [row.id] }); expect(reused.statusCode).toBe(409);
    expect(await prisma.clientPayment.count({ where: { kind: 'SENA' } })).toBe(1);
    expect(await prisma.clientPayment.count({ where: { kind: 'APLICACION' } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'deposit.applied' } })).toBe(1);
  });
  it.each(['REFUND', 'CREDIT'] as const)('cancels to %s, releases and preserves history; retry is idempotent', async mode => {
    const f = await fixture(); const row = await deposit(f, { productId: f.inventoryItem.id });
    expect((await cancel(f, row.id, mode)).statusCode).toBe(200); expect((await cancel(f, row.id, mode)).statusCode).toBe(200);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).status).toBe('DISPONIBLE');
    expect(await prisma.clientPayment.count({ where: { kind: mode === 'REFUND' ? 'DEVOLUCION' : 'CREDITO' } })).toBe(1);
    expect(await prisma.clientDeposit.count()).toBe(1);
    if (mode === 'CREDIT') { const reused = await sale(f, { depositIds: [row.id] }); expect(reused.statusCode, reused.body).toBe(201); }
    else expect((await sale(f, { depositIds: [row.id] })).statusCode).toBe(409);
  });
  it('refunds available credit exactly once in its original currency', async () => {
    const f = await fixture(); const row = await deposit(f, { currency: 'USD', amount: 50.25 });
    await cancel(f, row.id, 'CREDIT'); await cancel(f, row.id, 'REFUND'); await cancel(f, row.id, 'REFUND');
    const refunds = await prisma.clientPayment.findMany({ where: { kind: 'DEVOLUCION' } });
    expect(refunds).toHaveLength(1); expect(Number(refunds[0].amount)).toBe(50.25); expect(refunds[0].currency).toBe('USD');
  });
  it('rejects excess, duplicate IDs, bad quote and cross-store receipts without partial effects', async () => {
    const f = await fixture(); const row = await deposit(f);
    for (const change of [{ amount: 10 }, { depositIds: [row.id, row.id] }]) {
      const result = await sale(f, { depositIds: [row.id], ...change }); expect(result.statusCode, result.body).toBe(400);
    }
    const bad = await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits`, headers: f.headers, payload: { amount: 100, currency: 'ARS', exchangeRate: 0, method: 'EFECTIVO', requestKey: 'bad' } }); expect(bad.statusCode).toBe(400);
    const foreign = await seedStoreContext({ firebaseUid: 'foreign', email: 'foreign@example.com' });
    expect((await getApp().inject({ url: `/api/clients/${f.client.id}/deposits`, headers: buildAuthHeaders({ uid: foreign.user.firebaseUid, email: foreign.user.email! }) })).statusCode).toBe(404);
    expect((await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACTIVE'); expect(await prisma.sale.count()).toBe(0);
  });
  it('reserves a single device under concurrent deposits and consumes once under concurrent sales', async () => {
    const f = await fixture();
    const make = (key: string) => getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits`, headers: f.headers, payload: { amount: 100, currency: 'USD', exchangeRate: 1000, productId: f.inventoryItem.id, method: 'EFECTIVO', requestKey: key } });
    const created = await Promise.all([make('one'), make('two')]);
    expect(created.map(row => row.statusCode).sort(), created.map(row => row.body).join("\n")).toEqual([201, 409]);
    const id = created.find(row => row.statusCode === 201)!.json().deposit.id;
    const results = await Promise.all([sale(f, { depositIds: [id] }), sale(f, { depositIds: [id] })]);
    expect(results.map(row => row.statusCode).sort()).toEqual([201, 409]);
    expect(await prisma.clientPayment.count({ where: { kind: 'SENA' } })).toBe(1); expect(await prisma.sale.count()).toBe(1);
  });
  it.each(['PENDIENTE', 'COMPLETADA'])('restores credit after cancelling %s sale, refunding only extra collections and preserving it after deletion', async status => {
    const f = await fixture(); const row = await deposit(f, { productId: f.inventoryItem.id });
    const created = await sale(f, { depositIds: [row.id], status }); expect(created.statusCode, created.body).toBe(201);
    const id = created.json().sale.id;
    if (status === 'PENDIENTE') expect((await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/payments`, headers: f.headers, payload: { amount: 50, method: 'EFECTIVO', currency: 'USD' } })).statusCode).toBe(201);
    const response = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${id}/cancel`, headers: f.headers, payload: {} }); expect(response.statusCode, response.body).toBe(200);
    expect((await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CREDIT');
    const refund = await prisma.clientPayment.findFirstOrThrow({ where: { kind: 'DEVOLUCION' } }); expect(Number(refund.amount)).toBe(status === 'PENDIENTE' ? 50 : 400);
    expect(response.json().clients[0].pendingBalance).toBe(0); expect(response.json().inventory[0].status).toBe('DISPONIBLE');
    expect((await getApp().inject({ method: 'DELETE', url: `/api/sales/${id}`, headers: f.headers })).statusCode).toBe(204);
    expect((await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } })).saleId).toBe(id);
    const blocked = await getApp().inject({ method: 'DELETE', url: `/api/clients/${f.client.id}`, headers: f.headers });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toMatch(/saldo a favor/);
    expect(blocked.json().error).toMatch(/devolución del saldo/);
    const listed = await getApp().inject({ url: '/api/clients', headers: f.headers });
    expect(listed.json().clients.find((client: { id: string }) => client.id === f.client.id).creditBalance).toBe(100);
  });
  it('applies to a trade-in difference and restores credit on cancellation', async () => {
    const f = await fixture(); const row = await deposit(f, { currency: 'USD', amount: 100 });
    const response = await sale(f, { depositIds: [row.id], tradeIn: { deviceReceived: 'iPhone 11', takeValue: 200 } });
    expect(response.statusCode, response.body).toBe(201); expect(response.json().clients[0].pendingBalance).toBe(200);
    const cancelled = await getApp().inject({ method: 'POST', url: `/api/operations/sales/sales/${response.json().sale.id}/cancel`, headers: f.headers, payload: {} });
    expect(cancelled.statusCode, cancelled.body).toBe(200); expect(cancelled.json().clients[0].pendingBalance).toBe(0);
    expect(await prisma.clientPayment.count({ where: { kind: 'DEVOLUCION' } })).toBe(0); expect((await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CREDIT');
  });
  it('protects financial edits but allows completing payment with the correct remaining debt', async () => {
    const f = await fixture(); const row = await deposit(f);
    const response = await sale(f, { depositIds: [row.id] }); const id = response.json().sale.id;
    const update = (payload: Record<string, unknown>) => getApp().inject({ method: 'PATCH', url: `/api/operations/sales/sales/${id}`, headers: f.headers, payload });
    expect((await update({ amount: 600 })).statusCode).toBe(409);
    const completed = await update({ status: 'COMPLETADA' }); expect(completed.statusCode, completed.body).toBe(200); expect(completed.json().clients[0].pendingBalance).toBe(0);
    expect(completed.json().sale.depositAppliedAmount).toBe(100);
  });
  it('uses client credit as an existing repair partial payment; validates budget, identity, stock and financial guards', async () => {
    const f = await fixture(); const row = await deposit(f, { amount: 50, currency: 'USD' });
    const created = await getApp().inject({ method: 'POST', url: '/api/repairs', headers: f.headers, payload: { clientId: f.client.id, device: 'iPhone', fault: 'Pantalla', estimate: 200, deposit: 20, currency: 'USD' } });
    expect(created.statusCode, created.body).toBe(201); const id = created.json().order.id;
    const apply = () => getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits/${row.id}/repair`, headers: f.headers, payload: { repairId: id } });
    expect((await apply()).statusCode).toBe(200); expect((await apply()).statusCode).toBe(200);
    expect(Number((await prisma.repairOrder.findUniqueOrThrow({ where: { id } })).deposit)).toBe(70);
    expect(await prisma.clientPayment.count({ where: { kind: 'SENA' } })).toBe(1);
    expect((await getApp().inject({ method: 'PATCH', url: `/api/repairs/${id}`, headers: f.headers, payload: { deposit: 20 } })).statusCode).toBe(409);
    const removed = await getApp().inject({ method: 'DELETE', url: `/api/repairs/${id}`, headers: f.headers });
    expect(removed.statusCode, removed.body).toBe(204);
    expect(await prisma.repairOrder.findUnique({ where: { id } })).toBeNull();
    expect((await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CREDIT');
    expect((await cancel(f, row.id, 'REFUND')).statusCode).toBe(200);
    expect(await prisma.auditEvent.count({ where: { action: 'deposit.applied' } })).toBe(1);
  });
  it('requires client access to collect and sensitive permission to refund, allowing sales-only receipt read', async () => {
    const f = await fixture(); const row = await deposit(f);
    const staff = await prisma.user.create({ data: { firebaseUid: 'cashier', email: 'cashier@example.com', displayName: 'Empleado' } });
    const member = await prisma.storeMember.create({ data: { storeId: f.storeId, userId: staff.id, role: 'STAFF', sections: ['sales'], isDefault: true } });
    const headers = buildAuthHeaders({ uid: 'cashier', email: 'cashier@example.com' });
    expect((await getApp().inject({ url: `/api/clients/${f.client.id}/deposits`, headers })).statusCode).toBe(200);
    expect((await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits`, headers, payload: {} })).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: member.id }, data: { sections: ['clients', 'sales'] } });
    expect((await getApp().inject({ method: 'POST', url: `/api/clients/${f.client.id}/deposits/${row.id}/cancel`, headers, payload: { mode: 'REFUND' } })).statusCode).toBe(403);
    expect((await prisma.clientDeposit.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACTIVE');
  });
  it('keeps a client who still has an active deposit', async () => {
    const active = await fixture();
    await deposit(active);
    const blocked = await getApp().inject({ method: 'DELETE', url: `/api/clients/${active.client.id}`, headers: active.headers });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toMatch(/seña activa/);
    expect(await prisma.client.findUnique({ where: { id: active.client.id } })).not.toBeNull();
  });
  it('deletes a client after the deposit was refunded', async () => {
    const refunded = await fixture();
    const row = await deposit(refunded);
    expect((await cancel(refunded, row.id, 'REFUND')).statusCode).toBe(200);
    const removed = await getApp().inject({ method: 'DELETE', url: `/api/clients/${refunded.client.id}`, headers: refunded.headers });
    expect(removed.statusCode, removed.body).toBe(204);
    expect(await prisma.client.findUnique({ where: { id: refunded.client.id } })).toBeNull();
    expect(await prisma.clientDeposit.count({ where: { clientId: refunded.client.id } })).toBe(0);
  });
});
