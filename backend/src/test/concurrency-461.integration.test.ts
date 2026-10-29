import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

// Background analytics must not intercept barriers intended for a business transaction.
vi.mock('../modules/analytics/first-sale.js', () => ({ trackFirstSale: vi.fn(async () => {}) }));

const probe = vi.hoisted(() => ({ before: null as null | ((model: string, operation: string) => Promise<void>), after: null as null | ((model: string, operation: string) => Promise<void>), reads: 0 }));
vi.mock('../plugins/prisma.js', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  // Query text only; fixture queries are excluded by resetting the counter. Never retain parameters.
  client.$on('query', event => { if (/^SELECT/i.test(event.query)) probe.reads++; });
  return { prisma: client.$extends({ query: { async $allOperations({ model, operation, args, query }) {
    await probe.before?.(model ?? '', operation);
    const result = await query(args);
    await probe.after?.(model ?? '', operation);
    return result;
  } } }) };
});
import { prisma } from '../plugins/prisma.js';
import { ensureTestDatabase, resetDatabase, seedCatalogFixture, seedStoreContext } from './db.js';
import { collectAccount, addMovement } from '../modules/accounts/accounts.service.js';
import { updateClient, registerClientPayment, deleteClient } from '../modules/clients/clients.service.js';
import { createRegister, startSession } from '../modules/cash/service.js';
import { resolveStockCount } from '../modules/stock-counts/stock-counts.service.js';
import { createRepair, updateRepair, changeRepairStatus } from '../modules/repairs/repairs.service.js';
import { createOperation, cancelSaleOperation } from '../modules/operations/operations.service.js';
import { importSales } from '../modules/sales/sales.service.js';
import { deleteInventoryItem } from '../modules/inventory/inventory.service.js';
import { createDeposit } from '../modules/deposits/deposits.service.js';
import { getCommissionPeriod, getCommissionReport, bulkAssignSeller } from '../modules/commissions/commissions.service.js';
import { recordSaleCommission, refreshSaleCommission } from '../modules/commissions/commission-ledger.js';
import { writeAudit } from '../modules/audit/audit.js';
import { saleCode } from '../modules/audit/archive.js';
import { listCatalogs, saveCatalog } from '../modules/catalogs/catalogs.service.js';
import { archiveExpense, restoreExpense, updateExpense } from '../modules/expenses/expenses.service.js';
import { archiveSupplier, restoreSupplier, updateSupplier } from '../modules/suppliers/suppliers.service.js';

beforeAll(ensureTestDatabase);
beforeEach(async () => { vi.restoreAllMocks(); probe.before = null; probe.after = null; await resetDatabase(); });
afterAll(() => prisma.$disconnect());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function pauseNext(model: string, operation = 'findFirst') {
  const reached = deferred(), release = deferred();
  probe.after = async (m, op) => {
    if (m !== model || op !== operation) return;
    probe.after = null;
    reached.resolve();
    await release.promise;
  };
  return { reached: reached.promise, release: release.resolve };
}
function pauseTransaction() {
  const reached = deferred(), release = deferred();
  const original = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }) => {
    reached.resolve();
    await release.promise;
    return original(work, options);
  }) as typeof prisma.$transaction);
  return { reached: reached.promise, release: release.resolve };
}
async function overlap<T>(model: string, first: () => Promise<T>, second: () => Promise<unknown>, operation?: string) {
  const gate = model === '$transaction' ? pauseTransaction() : pauseNext(model, operation);
  const a = first();
  // Attach a handler immediately: a losing write may reject before we await its result.
  const settled = a.then(value => ({ status: 'fulfilled' as const, value }), reason => ({ status: 'rejected' as const, reason }));
  await gate.reached;
  try { await second(); } finally { gate.release(); }
  return settled;
}
async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  const rows = await seedCatalogFixture(storeId);
  const actor = { userId: owner.user.id, name: 'Owner' };
  const box = await createRegister(storeId, { name: 'Caja', currency: 'ARS', method: 'EFECTIVO', opening: 0 }, actor);
  await startSession(storeId, box.id, actor);
  return { ...rows, storeId, actor, member: { userId: owner.user.id, role: 'OWNER' } };
}
async function pending(f: Awaited<ReturnType<typeof fixture>>, amount = 100) {
  const result = await createOperation(f.storeId, 'sales', { clientId: f.client.id, deviceLabel: 'Equipo', amount, currency: 'ARS', paymentMethod: 'EFECTIVO', status: 'PENDIENTE' }, f.actor);
  if (!('sale' in result) || !result.sale) throw new Error('Expected sale');
  return result as typeof result & { sale: NonNullable<typeof result.sale> };
}
async function balance(id: string) { return Number((await prisma.client.findUniqueOrThrow({ where: { id } })).pendingBalance); }
async function cash(storeId: string) {
  const rows = await prisma.cashMovement.findMany({ where: { storeId } });
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

describe('financial concurrency #461', () => {
  it.each([30, 70])('serializes simultaneous partial/excess sale collections (%s)', async amount => {
    const f = await fixture(), result = await pending(f);
    const input = { clientId: f.client.id, saleId: result.sale!.id, amount, method: 'EFECTIVO', currency: 'ARS' };
    const a = await overlap(amount === 70 ? 'Sale' : 'Client', () => collectAccount(f.storeId, input, f.actor), () => collectAccount(f.storeId, input, f.actor));
    expect(a.status).toBe(amount === 30 ? 'fulfilled' : 'rejected');
    expect(await balance(f.client.id)).toBe(amount === 30 ? 40 : 30);
    expect(Number((await prisma.sale.findUniqueOrThrow({ where: { id: input.saleId } })).openBalance)).toBe(amount === 30 ? 40 : 30);
    expect(await prisma.clientPayment.count({ where: { clientId: f.client.id, kind: 'PAGO' } })).toBe(amount === 30 ? 2 : 1);
    expect(await cash(f.storeId)).toBe(amount === 30 ? 60 : 70);
  });
  it('preserves payments on different sales of one client', async () => {
    const f = await fixture(), a = await pending(f), b = await pending(f);
    const pay = (saleId: string) => collectAccount(f.storeId, { clientId: f.client.id, saleId, amount: 30, method: 'EFECTIVO' }, f.actor);
    expect((await overlap('Client', () => pay(a.sale!.id), () => pay(b.sale!.id))).status).toBe('fulfilled');
    expect(await balance(f.client.id)).toBe(140);
    expect(await cash(f.storeId)).toBe(60);
  });
  it('serializes manual payments and balance adjustments', async () => {
    const f = await fixture();
    await prisma.client.update({ where: { id: f.client.id }, data: { pendingBalance: 100 } });
    expect((await overlap('Client', () => registerClientPayment(f.storeId, f.client.id, { amount: 30, method: 'EFECTIVO' }), () => addMovement(f.storeId, f.client.id, { kind: 'CARGO', amount: 20 }, f.actor))).status).toBe('fulfilled');
    expect(await balance(f.client.id)).toBe(90);
    expect(await prisma.clientPayment.count()).toBe(2);
    expect(await cash(f.storeId)).toBe(30);
  });
  it('does not overwrite a collection or a separate contact patch when renaming', async () => {
    const f = await fixture(), sale = await pending(f);
    await overlap('Client', () => updateClient(f.storeId, f.client.id, { name: 'Nuevo' }, f.actor), async () => {
      await collectAccount(f.storeId, { clientId: f.client.id, saleId: sale.sale!.id, amount: 30, method: 'EFECTIVO' }, f.actor);
      await updateClient(f.storeId, f.client.id, { phone: '555' }, f.actor);
    });
    const row = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(row).toMatchObject({ name: 'Nuevo', phone: '555' });
    expect(Number(row.pendingBalance)).toBe(70);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.sale!.id } })).clientName).toBe('Nuevo');
  });
  it('does not overwrite an ordinary sale while renaming', async () => {
    const f = await fixture();
    await overlap('Client', () => updateClient(f.storeId, f.client.id, { name: 'Nuevo' }, f.actor), () => pending(f));
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(100);
  });
  it('rechecks repair remainder after a concurrent collection', async () => {
    const f = await fixture();
    const repair = await createRepair(f.storeId, { clientId: f.client.id, device: 'Equipo', estimate: 100, deposit: 0 }, f.actor);
    const input = { clientId: f.client.id, repairId: repair.order.id, amount: 70, method: 'EFECTIVO' };
    expect((await overlap('RepairOrder', () => collectAccount(f.storeId, input, f.actor), () => collectAccount(f.storeId, input, f.actor))).status).toBe('rejected');
    expect(Number((await prisma.repairOrder.findUniqueOrThrow({ where: { id: repair.order.id } })).deposit)).toBe(70);
    expect(await cash(f.storeId)).toBe(70);
    expect(await prisma.clientPayment.count()).toBe(1);
  });
  it('rechecks collection after concurrent cancellation', async () => {
    const f = await fixture(), sale = await pending(f);
    const result = await overlap('Sale', () => collectAccount(f.storeId, { clientId: f.client.id, saleId: sale.sale!.id, amount: 30, method: 'EFECTIVO' }, f.actor), () => cancelSaleOperation(f.storeId, sale.sale!.id, f.actor));
    expect(result.status).toBe('rejected');
    expect(await balance(f.client.id)).toBe(0);
    expect(await prisma.clientPayment.count({ where: { kind: 'PAGO' } })).toBe(0);
    expect(await cash(f.storeId)).toBe(0);
  });
});

describe('repair and archival concurrency #461', () => {
  it.each(['patch', 'collection'])('validates estimate against the latest %s deposit', async mode => {
    const f = await fixture();
    const repair = await createRepair(f.storeId, { clientId: f.client.id, device: 'Equipo', estimate: 100, deposit: 10 }, f.actor);
    const result = await overlap('RepairOrder', () => updateRepair(f.storeId, repair.order.id, { estimate: 50 }), () => mode === 'patch'
      ? updateRepair(f.storeId, repair.order.id, { deposit: 80 })
      : collectAccount(f.storeId, { clientId: f.client.id, repairId: repair.order.id, amount: 70, method: 'EFECTIVO' }, f.actor));
    expect(result.status).toBe('rejected');
    const row = await prisma.repairOrder.findUniqueOrThrow({ where: { id: repair.order.id } });
    expect(Number(row.estimate)).toBe(100);
    expect(Number(row.deposit)).toBe(80);
    expect(await cash(f.storeId)).toBe(80);
  });
  it('emits status history once for simultaneous identical transitions', async () => {
    const f = await fixture();
    const repair = await createRepair(f.storeId, { device: 'Equipo' }, f.actor);
    const gate = pauseNext('RepairOrder');
    const first = changeRepairStatus(f.storeId, repair.order.id, 'EN_REPARACION', f.actor);
    await gate.reached;
    // An old implementation reaches the competing read; the fixed one first waits on its row lock.
    probe.before = async (_model, operation) => { if (operation === '$queryRaw') { probe.before = null; gate.release(); } };
    probe.after = async (model, operation) => { if (model === 'RepairOrder' && operation === 'findFirst') { probe.after = null; gate.release(); } };
    await Promise.all([first, changeRepairStatus(f.storeId, repair.order.id, 'EN_REPARACION', f.actor)]);
    probe.before = null;
    probe.after = null;
    expect(await prisma.repairStatusEvent.count({ where: { orderId: repair.order.id, status: 'EN_REPARACION' } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { entityId: repair.order.id, action: 'repair.status' } })).toBe(1);
  });
  it('revalidates active operations before archiving inventory', async () => {
    const f = await fixture();
    const result = await overlap('$transaction', () => deleteInventoryItem(f.storeId, f.inventoryItem.id, f.actor), () => createOperation(f.storeId, 'sales', { productId: f.inventoryItem.id, clientId: f.client.id, amount: 100, paymentMethod: 'EFECTIVO', status: 'PENDIENTE' }, f.actor));
    expect(result.status).toBe('rejected');
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } })).archivedAt).toBeNull();
    expect(await prisma.auditEvent.count({ where: { action: 'inventory.archived' } })).toBe(0);
  });
  it('revalidates active operations before archiving clients', async () => {
    const f = await fixture();
    const result = await overlap('$transaction', () => deleteClient(f.storeId, f.client.id, f.actor), () => pending(f));
    expect(result.status).toBe('rejected');
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).archivedAt).toBeNull();
  });
  it('revalidates deposit eligibility before archiving clients', async () => {
    const f = await fixture();
    const result = await overlap('ClientDeposit', () => deleteClient(f.storeId, f.client.id, f.actor), () => createDeposit(f.storeId, f.client.id, { amount: 30, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', requestKey: 'deposit' }, f.actor), 'findMany');
    expect(result.status).toBe('rejected');
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).archivedAt).toBeNull();
  });
  it('audits duplicate client/inventory archive attempts once', async () => {
    const f = await fixture();
    await Promise.all([1, 2].map(() => deleteInventoryItem(f.storeId, f.inventoryItem.id, f.actor)));
    await Promise.all([1, 2].map(() => deleteClient(f.storeId, f.client.id, f.actor)));
    expect(await prisma.auditEvent.count({ where: { action: 'inventory.archived' } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: 'client.archived' } })).toBe(1);
  });
});

describe('import consistency #461', () => {
  it.each(['ordinary sale', 'second distinct import'])('preserves current totals against %s', async mode => {
    const f = await fixture();
    const rows = [{ clientName: f.client.name, clientDni: f.client.dni!, device: 'Imported', amount: '30', currency: 'USD', date: '01/01/2026' }];
    const result = await overlap('Client', () => importSales(f.storeId, rows, f.actor), () => mode === 'ordinary sale' ? pending(f) : importSales(f.storeId, rows.map(row => ({ ...row, device: 'Another imported device' })), f.actor), 'findMany');
    expect(result).toMatchObject({ status: 'fulfilled', value: { imported: 1, errors: [] } });
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).totalSpent)).toBe(mode === 'ordinary sale' ? 130 : 60);
    expect(await cash(f.storeId)).toBe(0);
  });
  it('rechecks reservation after the initial item lookup', async () => {
    const f = await fixture();
    const result = await overlap('InventoryItem', () => importSales(f.storeId, [{ clientName: f.client.name, productImei: f.inventoryItem.imei!, amount: '30' }], f.actor), () => createDeposit(f.storeId, f.client.id, { amount: 10, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', productId: f.inventoryItem.id, requestKey: 'reservation' }, f.actor));
    expect(result).toMatchObject({ status: 'fulfilled', value: { imported: 1, errors: [], warnings: [expect.objectContaining({ message: expect.stringMatching(/no disponible/) })] } });
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: f.inventoryItem.id } });
    expect(item.status).toBe('RESERVADO');
    expect(item.reservedDepositId).toBeTruthy();
    expect(await prisma.sale.count()).toBe(1);
  });
  it('rolls back the whole import if a seller is invalid, including newly created clients', async () => {
    const f = await fixture();
    const row = { clientName: 'New import client', device: 'Equipo', amount: '30' };
    await expect(importSales(f.storeId, [row, { ...row, sellerMemberId: 'missing-member' }], f.actor)).rejects.toThrow();
    expect(await prisma.client.findFirst({ where: { storeId: f.storeId, name: row.clientName } })).toBeNull();
    expect(await prisma.sale.count()).toBe(0);
    expect(await cash(f.storeId)).toBe(0);
  });
});

async function countFixture(size = 1) {
  const f = await fixture();
  const items = [f.inventoryItem];
  for (let i = 1; i < size; i++) {
    const { id: _id, createdAt: _created, updatedAt: _updated, ...data } = f.inventoryItem;
    items.push(await prisma.inventoryItem.create({ data: { ...data, customFields: {}, imei: String(359123456789012 + i) } }));
  }
  const line = (id: string | null, imei: string) => ({ key: id ?? imei, inventoryItemId: id, imei, model: 'Equipo', capacity: '', color: '', price: 100, currency: 'ARS', note: null });
  const surplus = '352000000000006';
  const count = await prisma.stockCount.create({ data: {
    storeId: f.storeId, startedById: f.actor.userId, startedByName: 'Owner', status: 'CLOSED', closedAt: new Date(),
    result: { matched: [], missing: items.map(item => line(item.id, item.imei!)), surplus: [line(null, surplus)], sold: [], excludedNoImei: 0, scanCount: 1, counters: ['Owner'] },
  } });
  const adjust = (mode: 'ADJUST' | 'RECORD' = 'ADJUST') => resolveStockCount(f.storeId, count.id, f.member, f.actor, { mode, missingIds: items.map(item => item.id), surplusImeis: [surplus] });
  return { ...f, items, count, adjust, surplus };
}
describe('atomic stock adjustment #461', () => {
  it.each(['ADJUST', 'RECORD'] as const)('commits only one resolution against %s', async mode => {
    const f = await countFixture(2);
    const results = await Promise.allSettled([f.adjust(), f.adjust(mode)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.auditEvent.count({ where: { entityId: f.count.id } })).toBe(1);
    const count = await prisma.stockCount.findUniqueOrThrow({ where: { id: f.count.id } });
    const archived = await prisma.inventoryItem.count({ where: { storeId: f.storeId, archivedAt: { not: null } } });
    expect(archived).toBe(count.resolution === 'ADJUSTED' ? 2 : 0);
    expect(await prisma.inventoryItem.count({ where: { storeId: f.storeId, imei: f.surplus } })).toBe(count.resolution === 'ADJUSTED' ? 1 : 0);
    expect(await prisma.auditEvent.count({ where: { action: 'inventory.archived' } })).toBe(archived);
  });
  it('rolls back earlier archival and audits when surplus validation fails', async () => {
    const f = await countFixture(2);
    const { id: _id, createdAt: _created, updatedAt: _updated, ...data } = f.inventoryItem;
    await prisma.inventoryItem.create({ data: { ...data, customFields: {}, imei: f.surplus, archivedAt: new Date() } });
    await expect(f.adjust()).rejects.toThrow(/archivado/);
    expect(await prisma.inventoryItem.count({ where: { id: { in: f.items.map(item => item.id) }, archivedAt: null } })).toBe(2);
    expect(await prisma.auditEvent.count({ where: { action: { in: ['inventory.archived', 'stockcount.adjusted'] } } })).toBe(0);
    expect((await prisma.stockCount.findUniqueOrThrow({ where: { id: f.count.id } })).resolution).toBeNull();
  });
  it('rolls back a selection containing a newly reserved item', async () => {
    const f = await countFixture(2);
    await createDeposit(f.storeId, f.client.id, { amount: 10, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', productId: f.items[1].id, requestKey: 'reserve' }, f.actor);
    await expect(f.adjust()).rejects.toThrow(/seña/);
    expect(await prisma.inventoryItem.count({ where: { storeId: f.storeId, archivedAt: { not: null } } })).toBe(0);
    expect((await prisma.stockCount.findUniqueOrThrow({ where: { id: f.count.id } })).resolution).toBeNull();
  });
  it('bounds eligibility read queries independently of selection size', async () => {
    const f = await countFixture(1);
    probe.reads = 0;
    await f.adjust();
    const small = probe.reads;
    await resetDatabase();
    const large = await countFixture(30);
    probe.reads = 0;
    await large.adjust();
    expect(probe.reads).toBeLessThanOrEqual(small + 2);
    expect(await prisma.auditEvent.count({ where: { action: 'inventory.archived' } })).toBe(30);
  });
});

describe('catalog and archive transitions #461', () => {
  it('initializes catalogs concurrently without collisions', async () => {
    const f = await fixture();
    const results = await Promise.all([1, 2, 3].map(() => listCatalogs(f.storeId)));
    expect(results[0].options.length).toBeGreaterThan(20);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
  it('coordinates initialization with saving an option', async () => {
    const f = await fixture();
    await Promise.all([
      listCatalogs(f.storeId),
      saveCatalog(f.storeId, 'INVENTORY_STATUS', [{ value: 'DISPONIBLE', label: 'Stock disponible' }], []),
    ]);
    const rows = await prisma.storeCatalogOption.findMany({ where: { storeId: f.storeId, kind: 'INVENTORY_STATUS', value: 'DISPONIBLE' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Stock disponible');
  });
  it.each(['expense', 'supplier'])('audits duplicate %s archive and restore once', async kind => {
    const f = await fixture();
    const row = kind === 'expense' ? await prisma.expense.create({ data: { storeId: f.storeId, spentAt: new Date(), category: 'Alquiler', amount: 100, currency: 'ARS' } }) : await prisma.supplier.create({ data: { storeId: f.storeId, name: 'Proveedor' } });
    const archive = () => kind === 'expense' ? archiveExpense(f.storeId, row.id, f.actor) : archiveSupplier(f.storeId, row.id, f.actor);
    const restore = () => kind === 'expense' ? restoreExpense(f.storeId, row.id, f.actor) : restoreSupplier(f.storeId, row.id, f.actor);
    const results = await Promise.all([archive(), archive()]);
    expect(results.sort()).toEqual([false, true]);
    const restored = await Promise.all([restore(), restore()]);
    expect(restored.filter(Boolean)).toHaveLength(1);
    expect(await prisma.auditEvent.count({ where: { action: `${kind}.archived` } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: `${kind}.restored` } })).toBe(1);
  });
  it.each(['expense', 'supplier'])('does not edit an archived %s after a stale lookup', async kind => {
    const f = await fixture();
    if (kind === 'expense') {
      const row = await prisma.expense.create({ data: { storeId: f.storeId, spentAt: new Date(), category: 'Alquiler', amount: 100, currency: 'ARS' } });
      const result = await overlap('$transaction', () => updateExpense(f.storeId, row.id, { date: '2026-01-01', category: 'Nuevo', amount: 200, currency: 'ARS' }, f.actor), () => archiveExpense(f.storeId, row.id, f.actor));
      expect(result).toMatchObject({ status: 'fulfilled', value: null });
      expect((await prisma.expense.findUniqueOrThrow({ where: { id: row.id } })).category).toBe('Alquiler');
    } else {
      const row = await prisma.supplier.create({ data: { storeId: f.storeId, name: 'Proveedor' } });
      const result = await overlap('$transaction', () => updateSupplier(f.storeId, row.id, { name: 'Nuevo' }, f.actor), () => archiveSupplier(f.storeId, row.id, f.actor));
      expect(result).toMatchObject({ status: 'fulfilled', value: null });
      expect((await prisma.supplier.findUniqueOrThrow({ where: { id: row.id } })).name).toBe('Proveedor');
    }
    expect(await prisma.auditEvent.count({ where: { action: `${kind}.updated` } })).toBe(0);
  });
});

async function commissionFixture(size = 8) {
  const f = await fixture();
  const original = await prisma.storeMember.findFirstOrThrow({ where: { storeId: f.storeId } });
  const user = await prisma.user.create({ data: { firebaseUid: 'seller', email: 'seller@example.com', displayName: 'Seller' } });
  const seller = await prisma.storeMember.create({ data: { storeId: f.storeId, userId: user.id, role: 'STAFF' } });
  await prisma.commissionRule.createMany({ data: [
    { storeId: f.storeId, memberId: null, basis: 'SALE_PERCENT', rate: 10, effectiveFrom: new Date('2020-01-01'), createdBy: f.actor.userId },
    { storeId: f.storeId, memberId: seller.id, basis: 'FIXED_PER_UNIT', rate: 5, currency: 'USD', effectiveFrom: new Date('2026-02-01'), createdBy: f.actor.userId },
  ] });
  const sales = [];
  for (let i = 0; i < size; i++) {
    const sale = await prisma.sale.create({ data: {
      storeId: f.storeId, clientId: f.client.id, saleNumber: i + 1, dateLabel: '01/01/2026', soldAt: new Date(i % 2 ? '2026-02-03' : '2026-01-03'),
      amount: 100 + i, amountCurrency: i % 2 ? 'USD' : 'ARS', exchangeRate: 1000, paymentMethod: 'EFECTIVO', deviceLabel: `Equipo ${i}`,
      status: i === 5 ? 'PENDIENTE' : 'COMPLETADA', sellerMemberId: i === 3 ? null : i === 4 ? seller.id : original.id,
      inventoryItemId: i % 2 ? f.inventoryItem.id : null,
    } });
    await prisma.$transaction(tx => recordSaleCommission(tx, f.storeId, sale.id));
    sales.push(sale);
  }
  await prisma.commissionPayment.createMany({ data: ['ARS', 'USD'].map(currency => ({ storeId: f.storeId, memberId: original.id, period: '2026-02', amount: 20, currency, settlesCurrency: currency, exchangeRate: 1000, createdBy: f.actor.userId, createdAt: new Date('2026-02-20') })) });
  return { ...f, original, seller, sales };
}
async function commissionSnapshot(db: Prisma.TransactionClient, storeId: string) {
  const [accruals, audits] = await Promise.all([
    db.commissionAccrual.findMany({ where: { storeId }, orderBy: [{ saleNumber: 'asc' }, { createdAt: 'asc' }] }),
    db.auditEvent.findMany({ where: { storeId, action: 'sale.seller.changed' }, orderBy: { entityLabel: 'asc' } }),
  ]);
  return {
    accruals: accruals.map(({ id: _id, createdAt: _created, voidedAt, ...row }) => ({ ...row, voided: !!voidedAt })),
    audits: audits.map(({ id: _id, createdAt: _created, ...row }) => row),
  };
}
describe('batched commissions #461', () => {
  it.each([null, 'seller'] as const)('matches sequential seller reassignment and audit snapshots (%s)', async assignment => {
    const f = await commissionFixture();
    const memberId = assignment ? f.seller.id : null;
    let expected: Awaited<ReturnType<typeof commissionSnapshot>> | undefined;
    const rollback = new Error('rollback reference execution');
    await expect(prisma.$transaction(async tx => {
      for (const sale of f.sales) {
        if (sale.sellerMemberId === memberId) continue;
        await tx.sale.update({ where: { id: sale.id }, data: { sellerMemberId: memberId } });
        await refreshSaleCommission(tx, f.storeId, sale.id);
        await writeAudit(tx, { storeId: f.storeId, actor: f.actor, action: 'sale.seller.changed', entityType: 'sale', entityId: sale.id, entityLabel: saleCode(sale.saleNumber), detail: `${sale.sellerMemberId ?? 'Sin vendedor'} → ${memberId ?? 'Sin vendedor'}` });
      }
      expected = await commissionSnapshot(tx, f.storeId);
      throw rollback;
    })).rejects.toBe(rollback);
    await bulkAssignSeller(f.storeId, f.actor, f.sales.map(sale => sale.id), memberId);
    expect(await commissionSnapshot(prisma, f.storeId)).toEqual(expected);
  });
  it('bounds seller-assignment read queries for 1 and 30 sales', async () => {
    const f = await commissionFixture(1);
    probe.reads = 0;
    await bulkAssignSeller(f.storeId, f.actor, f.sales.map(sale => sale.id), f.seller.id);
    const small = probe.reads;
    await resetDatabase();
    const large = await commissionFixture(30);
    probe.reads = 0;
    await bulkAssignSeller(large.storeId, large.actor, large.sales.map(sale => sale.id), large.seller.id);
    expect(probe.reads).toBeLessThanOrEqual(small + 2);
    expect(await prisma.auditEvent.count({ where: { action: 'sale.seller.changed' } })).toBe(29);
  });
  it('preserves period cutoffs, FIFO, cancellations, carryovers and mixed currency adjustments', async () => {
    const f = await commissionFixture();
    await prisma.$transaction(tx => refreshSaleCommission(tx, f.storeId, f.sales[0].id));
    await prisma.commissionAccrual.updateMany({ where: { sourceSaleId: f.sales[0].id }, data: { voidedAt: new Date('2026-03-01'), voidReason: 'CANCELLED', adjustmentPeriod: '2026-04' } });
    await prisma.commissionPayment.create({ data: { storeId: f.storeId, memberId: f.original.id, period: '2026-03', amount: 10, currency: 'USD', settlesCurrency: 'ARS', exchangeRate: 1000, createdBy: f.actor.userId, voidedAt: new Date('2026-04-01') } });
    const report = await getCommissionReport(f.storeId, '2026-01', '2026-05');
    const expected = [];
    for (const period of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']) {
      const data = await getCommissionPeriod(f.storeId, period);
      expected.push(...data.people.map(({ memberId, name, salesCount, earned, paid, pending, adjustmentsTotal, converted }) => ({ period, memberId, name, salesCount, earned, paid, pending, adjustmentsTotal, converted })));
    }
    expect(report.rows).toEqual(expected);
  });
  it('bounds report read queries for 1, 12 and 120 months', async () => {
    const f = await commissionFixture();
    const counts = [];
    for (const to of ['2026-01', '2026-12', '2035-12']) {
      probe.reads = 0;
      await getCommissionReport(f.storeId, '2026-01', to);
      counts.push(probe.reads);
    }
    expect(counts[1]).toBeLessThanOrEqual(counts[0] + 1);
    expect(counts[2]).toBeLessThanOrEqual(counts[0] + 1);
  });
});

describe('additional transaction boundaries #461', () => {
  it('allocates simultaneous partial installment payments without losing coverage', async () => {
    const f = await fixture();
    const result = await createOperation(f.storeId, 'sales', { clientId: f.client.id, deviceLabel: 'Cuotas', amount: 300, currency: 'ARS', paymentMethod: 'EFECTIVO', tenders: [{ amount: 100, currency: 'ARS', method: 'EFECTIVO' }], installments: { count: 2, frequency: 'MENSUAL', firstDueDate: '2026-11-01' } }, f.actor);
    if (!('sale' in result) || !result.sale) throw new Error('Expected sale');
    const saleId = result.sale.id;
    const pay = () => collectAccount(f.storeId, { clientId: f.client.id, saleId, amount: 70, method: 'EFECTIVO' }, f.actor);
    expect((await overlap('Client', pay, pay)).status).toBe('fulfilled');
    const rows = await prisma.saleInstallment.findMany({ where: { saleId }, orderBy: { sequence: 'asc' } });
    expect(rows.map(row => Number(row.paidAmount))).toEqual([100, 40]);
    expect(await balance(f.client.id)).toBe(60);
    expect(await cash(f.storeId)).toBe(240);
    expect(await prisma.clientPayment.count({ where: { saleId, kind: 'PAGO' } })).toBe(3);
  });
  it.each(['sale', 'reservation'])('rejects an adjustment after a concurrent %s without partial stock changes', async mode => {
    const f = await countFixture(2);
    const result = await overlap('$transaction', () => f.adjust(), () => mode === 'sale'
      ? createOperation(f.storeId, 'sales', { clientId: f.client.id, productId: f.items[1].id, amount: 100, paymentMethod: 'EFECTIVO', status: 'PENDIENTE' }, f.actor)
      : createDeposit(f.storeId, f.client.id, { productId: f.items[1].id, amount: 10, currency: 'ARS', exchangeRate: 1000, method: 'EFECTIVO', requestKey: 'concurrent-reserve' }, f.actor));
    expect(result.status).toBe('rejected');
    expect(await prisma.inventoryItem.count({ where: { storeId: f.storeId, archivedAt: { not: null } } })).toBe(0);
    expect(await prisma.inventoryItem.count({ where: { storeId: f.storeId, imei: f.surplus } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { action: 'inventory.archived' } })).toBe(0);
    expect((await prisma.stockCount.findUniqueOrThrow({ where: { id: f.count.id } })).resolution).toBeNull();
  });
});

describe('retry validation #461', () => {
  it('rechecks client financial edit eligibility after a concurrent sale', async () => {
    const f = await fixture();
    const result = await overlap('$transaction', () => updateClient(f.storeId, f.client.id, { pendingBalance: 80 }, f.actor), () => pending(f));
    expect(result.status).toBe('rejected');
    expect(await balance(f.client.id)).toBe(100);
  });
  it('rechecks repair price permission against a concurrently changed estimate', async () => {
    const f = await fixture();
    const repair = await createRepair(f.storeId, { device: 'Equipo', estimate: 100 }, f.actor);
    const result = await overlap('RepairOrder', () => updateRepair(f.storeId, repair.order.id, { estimate: 100 }, { canChangePrice: false, actor: f.actor }), () => updateRepair(f.storeId, repair.order.id, { estimate: 200 }));
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toMatchObject({ statusCode: 403 });
    expect(Number((await prisma.repairOrder.findUniqueOrThrow({ where: { id: repair.order.id } })).estimate)).toBe(200);
  });
});
