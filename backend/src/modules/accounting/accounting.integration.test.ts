import { storedStateFilter } from '../../lib/accounting-states.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { resetDatabase, seedCatalogFixture, seedStoreContext } from '../../test/db.js';
import { assertStoreReferences, STORE_REFERENCES } from '../../lib/store-references.js';
import { confirmTradeOperation, createOperation, cancelSaleOperation } from '../operations/operations.service.js';
import { countSession, reviewSession } from '../cash/service.js';
import { listCreditNotes, listReturnCases, createReturnCase } from '../returns/returns.service.js';
import { listDeposits } from '../deposits/deposits.service.js';
import { listSales } from '../sales/sales.service.js';
import { collectAccount } from '../accounts/accounts.service.js';

const actor = { userId: 'ficticio', name: 'Contable local' };
let storeId: string;
let otherStoreId: string;
let parents: Record<string, string>;
let ownClientId: string;
let ownSaleId: string;

async function seedParents(store: string, memberId: string) {
  const f = await seedCatalogFixture(store);
  const supplier = await prisma.supplier.create({ data: { storeId: store, name: 'Proveedor ficticio' } });
  const purchase = await prisma.stockPurchase.create({ data: { storeId: store, supplierId: supplier.id, purchasedAt: new Date() } });
  const trade = await prisma.tradeIn.create({ data: { storeId: store, clientId: f.client.id, dateLabel: '03 nov 2026', deviceReceived: 'iPhone ficticio', takeValue: 20, differencePaid: 80, status: 'APROBADO', tradeAt: new Date() } });
  const sale = await prisma.sale.create({ data: { storeId: store, clientId: f.client.id, inventoryItemId: f.inventoryItem.id, dateLabel: '03 nov 2026', amount: 100, paymentMethod: 'EFECTIVO', status: 'PENDIENTE', soldAt: new Date() } });
  const repair = await prisma.repairOrder.create({ data: { storeId: store, clientId: f.client.id, device: 'iPhone falso' } });
  const claim = await prisma.returnCase.create({ data: { storeId: store, caseNumber: 1, saleId: sale.id, clientId: f.client.id, reason: 'Prueba', openedAt: new Date() } });
  const note = await prisma.creditNote.create({ data: { storeId: store, clientId: f.client.id, returnCaseId: claim.id, amount: 10, remaining: 10, currency: 'USD' } });
  const register = await prisma.cashRegister.create({ data: { storeId: store, name: 'Caja falsa', currency: 'USD', method: 'TRANSFERENCIA' } });
  const session = await prisma.cashSession.create({ data: { storeId: store, registerId: register.id, day: '2026-11-03', opening: 0, openedBy: actor.userId } });
  const movement = await prisma.cashMovement.create({ data: { storeId: store, registerId: register.id, sessionId: session.id, amount: 10, kind: 'COBRO' } });
  const deposit = await prisma.clientDeposit.create({ data: { storeId: store, clientId: f.client.id, requestKey: 'falsa', amount: 10, currency: 'USD', exchangeRate: 1000, usdAmount: 10, method: 'EFECTIVO' } });
  const rule = await prisma.commissionRule.create({ data: { storeId: store, memberId, rate: 10, effectiveFrom: new Date(), createdBy: actor.userId } });
  const plan = await prisma.saleInstallmentPlan.create({ data: { storeId: store, saleId: sale.id, clientId: f.client.id, count: 1, frequency: 'MENSUAL', firstDueDate: new Date(), financedAmount: 100 } });
  const count = await prisma.stockCount.create({ data: { storeId: store, startedById: actor.userId, startedByName: actor.name } });
  return { Client: f.client.id, ClientCategory: f.clientCategory.id, InventoryItem: f.inventoryItem.id, InventoryCategory: f.inventoryCategory.id, SaleCategory: f.saleCategory.id, TradeInCategory: f.tradeInCategory.id, StoreMember: memberId, Supplier: supplier.id, StockPurchase: purchase.id, TradeIn: trade.id, Sale: sale.id, RepairOrder: repair.id, ReturnCase: claim.id, CreditNote: note.id, CashRegister: register.id, CashSession: session.id, CashMovement: movement.id, ClientDeposit: deposit.id, CommissionRule: rule.id, SaleInstallmentPlan: plan.id, StockCount: count.id };
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });
beforeEach(async () => {
  await resetDatabase();
  const own = await seedStoreContext();
  const other = await seedStoreContext({ firebaseUid: 'otro', email: 'otro@example.com' });
  storeId = own.store!.id; otherStoreId = other.store!.id;
  parents = await seedParents(otherStoreId, other.membership!.id);
  const f = await seedCatalogFixture(storeId); ownClientId = f.client.id;
  const sale = await prisma.sale.create({ data: { storeId, clientId: ownClientId, dateLabel: '03 nov 2026', amount: 100, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', soldAt: new Date() } });
  ownSaleId = sale.id;
});

describe('pertenencia transaccional de referencias', () => {
  // One case per audited edge, including the references without a physical FK.
  it.each(STORE_REFERENCES)('$table.$field rechaza padre ajeno $parent', async ref => {
    await expect(prisma.$transaction(tx => assertStoreReferences(tx, storeId, ref.table, { storeId, [ref.field]: parents[ref.parent] }))).rejects.toMatchObject({ statusCode: 409 });
    await expect(prisma.$transaction(tx => assertStoreReferences(tx, otherStoreId, ref.table, { storeId: otherStoreId, [ref.field]: parents[ref.parent] }))).resolves.toBeUndefined();
  });
  it('admite nulos y tombstones históricos; rechaza padres requeridos inexistentes', async () => {
    await expect(prisma.$transaction(tx => assertStoreReferences(tx, storeId, 'ClientPayment', { clientId: ownClientId, saleId: 'venta-borrada' }))).resolves.toBeUndefined();
    await expect(prisma.$transaction(tx => assertStoreReferences(tx, storeId, 'Sale', { clientId: null }))).resolves.toBeUndefined();
    await expect(prisma.$transaction(tx => assertStoreReferences(tx, storeId, 'Sale', { clientId: 'inexistente' }))).rejects.toMatchObject({ statusCode: 409 });
  });
  it('cancelar una venta corrupta no modifica stock ajeno ni caja', async () => {
    await prisma.sale.update({ where: { id: ownSaleId }, data: { inventoryItemId: parents.InventoryItem, integratedOperation: true } });
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: parents.InventoryItem } });
    await expect(cancelSaleOperation(storeId, ownSaleId)).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.inventoryItem.findUnique({ where: { id: before.id } })).toEqual(before);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: ownSaleId } })).status).toBe('COMPLETADA');
    expect(await prisma.cashMovement.count({ where: { storeId } })).toBe(0);
  });
  it('crear una devolución con venta corrupta falla sin reclamo ni crédito', async () => {
    await prisma.sale.update({ where: { id: ownSaleId }, data: { clientId: parents.Client } });
    await expect(createReturnCase(storeId, { saleId: ownSaleId, reason: 'Falla', openedOn: '2026-11-03' }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.returnCase.count({ where: { storeId } })).toBe(0);
  });
  it('cobrar una venta con canje ajeno no modifica saldos', async () => {
    await prisma.client.update({ where: { id: ownClientId }, data: { pendingBalance: 100 } });
    await prisma.sale.update({ where: { id: ownSaleId }, data: { status: 'PENDIENTE', tradeInId: parents.TradeIn } });
    await expect(collectAccount(storeId, { clientId: ownClientId, saleId: ownSaleId, amount: 10, method: 'EFECTIVO' })).rejects.toMatchObject({ statusCode: 409 });
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: ownClientId } })).pendingBalance)).toBe(100);
    expect(await prisma.clientPayment.count({ where: { storeId } })).toBe(0);
  });
  it('conteo y aprobación rechazan sesiones ligadas a caja ajena', async () => {
    const session = await prisma.cashSession.create({ data: { storeId, registerId: parents.CashRegister, day: '2026-11-04', opening: 0, openedBy: actor.userId } });
    await expect(countSession(storeId, session.id, { counted: 0 }, actor)).rejects.toMatchObject({ statusCode: 409 });
    await prisma.cashSession.update({ where: { id: session.id }, data: { status: 'SUBMITTED' } });
    await expect(reviewSession(storeId, session.id, { action: 'APPROVE' }, actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.cashCount.count({ where: { storeId } })).toBe(0);
  });
  it('normaliza escrituras desde servicios y rechaza includes ajenos en la lectura', async () => {
    const result = await createOperation(storeId, 'sales', { clientId: ownClientId, deviceLabel: 'Equipo ficticio libre', amount: 10, paymentMethod: 'EFECTIVO', status: 'pending' });
    if (!('sale' in result) || !result.sale) throw new Error('Falta la venta');
    expect(result.sale.status).toBe('PENDIENTE');
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: result.sale!.id } })).status).toBe('PENDIENTE');
    await prisma.sale.update({ where: { id: ownSaleId }, data: { inventoryItemId: parents.InventoryItem } });
    await expect(listSales(storeId)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('serializa estados legacy sin reescribirlos y conserva crédito reconocido', async () => {
    await prisma.clientDeposit.create({ data: { storeId, clientId: ownClientId, requestKey: 'legacy', amount: 10, usdAmount: 10, currency: 'USD', exchangeRate: 1000, method: 'EFECTIVO', status: ' credit ' } });
    const claim = await prisma.returnCase.create({ data: { storeId, caseNumber: 2, saleId: ownSaleId, clientId: ownClientId, reason: 'Falla ficticia', openedAt: new Date(), status: ' en_diagnóstico ', rmaStatus: ' recibido ', events: { create: { storeId, status: ' recibido ' } } } });
    await prisma.creditNote.create({ data: { storeId, clientId: ownClientId, returnCaseId: claim.id, amount: 10, remaining: 10, currency: 'USD', status: ' abierta ' } });
    expect((await listDeposits(storeId, ownClientId))[0].status).toBe('CREDIT');
    expect((await listReturnCases(storeId))[0]).toMatchObject({ status: 'EN_DIAGNOSTICO', rmaStatus: 'RECIBIDO', creditNote: { status: 'ABIERTA' }, events: [{ status: 'RECIBIDO' }] });
    expect((await listCreditNotes(storeId))[0].status).toBe('ABIERTA');
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe(' en_diagnóstico ');
  });
  it('confirmar borrador con pending histórico conserva deuda sin registrar un cobro', async () => {
    const draft = await createOperation(storeId, 'tradeins', { draft: true, clientId: ownClientId, deviceLabel: 'Equipo libre', amount: 100, status: 'PENDIENTE', currency: 'ARS', paymentMethod: 'EFECTIVO', tradeIn: { deviceReceived: 'Recibido ficticio', takeValue: 20 } });
    if (!('tradeIn' in draft) || !draft.tradeIn) throw new Error('Falta borrador');
    await prisma.tradeIn.update({ where: { id: draft.tradeIn.id }, data: { draftPaymentStatus: ' pending ' } });
    const result = await confirmTradeOperation(storeId, draft.tradeIn.id, {});
    expect(result.sale.status).toBe('PENDIENTE');
    expect(Number((await prisma.client.findUniqueOrThrow({ where: { id: ownClientId } })).pendingBalance)).toBe(80);
    expect(await prisma.clientPayment.count({ where: { storeId, kind: 'PAGO' } })).toBe(0);
  });
  it('filtros SQL reconocen espacios, alias y mayúsculas sin backfill', async () => {
    for (const status of [' completed ', 'completada', ' PENDING ', 'ANULADA', ' cancelled ', 'INVENTADO']) await prisma.sale.create({ data: { storeId, status, dateLabel: '', amount: 10, paymentMethod: 'EFECTIVO', soldAt: new Date() } });
    const active = await storedStateFilter(prisma, 'Sale', storeId, ['COMPLETADA', 'PENDIENTE']);
    expect(await prisma.sale.count({ where: { storeId, status: active } })).toBe(4);
    const cancelled = await storedStateFilter(prisma, 'Sale', storeId, ['CANCELADA']);
    expect(await prisma.sale.count({ where: { storeId, status: cancelled } })).toBe(2);
    expect((await prisma.sale.findFirstOrThrow({ where: { storeId, status: ' completed ' } })).status).toBe(' completed ');
  });
});
