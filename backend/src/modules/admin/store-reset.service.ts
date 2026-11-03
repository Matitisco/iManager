import { storedStateFilter } from '../../lib/accounting-states.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';
import { prisma } from '../../plugins/prisma.js';
import { writeAudit } from '../audit/audit.js';
import { lockCash } from '../cash/service.js';
import { balanceStillOwed } from '../../lib/cancel-refund.js';

// Explicitly classify every tenant model. DELETE means eligible: dependent
// tables use the frozen selection below, never an unconditional tenant wipe.
export const STORE_RESET_KEEP_MODELS = [
  'Store', 'User', 'StoreMember', 'StoreInvitation', 'StoreFollowUpSettings',
  'PeriodicReportSettings', 'StorePublicCatalog', 'StoreCatalogOption',
  'CustomFieldDefinition', 'ClientCategory', 'InventoryCategory', 'TradeInCategory',
  'SaleCategory', 'CommissionRule', 'CashRegister', 'BillingCheckout', 'BillingPlan',
  'AuditEvent', 'ImeiTacMiss', 'StoreCounter', 'Client', 'RepairOrder',
  'RepairStatusEvent', 'CommissionPayment', 'CashCount', 'CashSession',
  'StockPurchase', 'Supplier', 'Expense', 'ProductEvent', 'PeriodicReportDelivery',
] as const satisfies readonly Prisma.ModelName[];

// FK order: children before parents. IDs are selected before the first deletion.
export const STORE_RESET_DELETE_MODELS = [
  'NotificationRead', 'SectionRecordView', 'StockCountScan', 'StockCountExpected',
  'StockCount', 'CreditNoteApplication', 'CreditNote', 'ReturnEvent', 'ReturnCase',
  'SaleInstallment', 'SaleInstallmentPlan', 'SaleTender', 'ClientDeposit',
  'ClientPayment', 'CommissionAccrual', 'CashMovement', 'Sale', 'TradeIn',
  'InventoryItem', 'StoreNotification',
] as const satisfies readonly Prisma.ModelName[];

export const STORE_RESET_FULL_DELETE_MODELS = [
  ...STORE_RESET_DELETE_MODELS, 'RepairStatusEvent', 'RepairOrder', 'Client',
] as const satisfies readonly Prisma.ModelName[];

export const storeResetBody = z.object({
  storeEmail: z.string().trim().email(),
  expectStoreName: z.string().min(1),
  expectStoreId: z.string().min(1).max(160),
  dryRun: z.boolean(),
  scope: z.literal('full').optional(),
  expect: z.record(z.number().int().nonnegative().safe()).optional(),
}).strict();
export type StoreResetBody = z.infer<typeof storeResetBody>;
type Tx = Prisma.TransactionClient;
type Counts = Record<string, number>;
type Plan = Partial<Record<Prisma.ModelName, Prisma.Sql>>;
type Report = { dryRun: boolean; store: { id: string; name: string }; willDelete: Counts; willKeep: Counts };
class DryRunRollback extends Error {
  constructor(public result: Report) { super('dry-run'); }
}
const models = Prisma.dmmf.datamodel.models;
const tenantModels = models.filter(model => model.fields.some(field => field.name === 'storeId'));
// All identifiers come from the schema or constants, never the request.
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
function table(model: Prisma.ModelName) {
  const definition = models.find(item => item.name === model)!;
  return Prisma.raw(quote(definition.dbName ?? definition.name));
}
function scope(model: Prisma.ModelName, storeId: string): Prisma.Sql {
  if (model === 'Store') return Prisma.sql`t."id" = ${storeId}`;
  if (model === 'User') return Prisma.sql`t."id" IN (SELECT "userId" FROM "StoreMember" WHERE "storeId" = ${storeId})`;
  if (model === 'NotificationRead') return Prisma.sql`t."notificationId" IN (SELECT "id" FROM "StoreNotification" WHERE "storeId" = ${storeId})`;
  if (model === 'BillingPlan' || model === 'ImeiTacMiss') return Prisma.sql`TRUE`;
  return Prisma.sql`t."storeId" = ${storeId}`;
}
const inIds = (column: string, ids: string[]) => Prisma.sql`t.${Prisma.raw(quote(column))} = ANY(${ids}::text[])`;
const notNull = (column: string) => Prisma.sql`t.${Prisma.raw(quote(column))} IS NOT NULL`;
function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new DomainError(message, 409);
}
function sameCounts(expected: Counts | undefined, actual: Counts) {
  return !!expected && Object.keys(expected).length === Object.keys(actual).length
    && Object.entries(actual).every(([model, count]) => Object.hasOwn(expected, model) && expected[model] === count);
}
async function count(tx: Tx, model: Prisma.ModelName, where: Prisma.Sql) {
  const [row] = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM ${table(model)} t WHERE ${where}`);
  return row!.count;
}
async function planReset(tx: Tx, storeId: string, full: boolean) {
  const plan: Plan = {};
  const ids: Partial<Record<Prisma.ModelName, string[]>> = {};
  async function select(model: Prisma.ModelName, predicate = Prisma.sql`TRUE`) {
    const where = Prisma.sql`(${scope(model, storeId)}) AND (${predicate})`;
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT t."id" FROM ${table(model)} t WHERE ${where}`);
    ids[model] = rows.map(row => row.id);
    // Freeze the IDs: later deletion of a parent must not change child scope.
    plan[model] = Prisma.sql`(${scope(model, storeId)}) AND (${inIds('id', ids[model])})`;
    return ids[model];
  }
  if (full) {
    // All operational rows belong to this reset, even archived rows, drafts,
    // loose deposits/credits and references to previously deleted operations.
    for (const model of STORE_RESET_FULL_DELETE_MODELS) {
      if (model !== 'CashMovement' && model !== 'StoreNotification' && model !== 'NotificationRead' && model !== 'SectionRecordView') await select(model);
    }
    const records = Object.values(ids).flat();
    await select('CashMovement', Prisma.sql`t."sourceType" IN ('sale', 'repair', 'client', 'deposit', 'return', 'trade-in', 'trade')
      OR (t."sourceType" IS NULL AND (${inIds('sourceId', records)} OR t."kind" IN ('COBRO', 'DEVOLUCION')))`);
    await includeCashReversals(tx, storeId, plan);
    const sections = Prisma.sql`t."section" IN ('sales', 'inventory', 'clients', 'service', 'repairs', 'tradeins', 'trade-ins', 'tradeIns', 'returns')`;
    const notices = await select('StoreNotification', Prisma.sql`${sections} OR ${inIds('recordId', records)}`);
    await select('NotificationRead', inIds('notificationId', notices));
    // SectionRecordView has a composite key, no id; the predicate uses only
    // literal sections and frozen record IDs, so parent deletions cannot alter it.
    plan.SectionRecordView = Prisma.sql`t."storeId" = ${storeId} AND (${sections} OR ${inIds('recordId', records)})`;
    return { plan, inventory: ids.InventoryItem! };
  }
  await select('Sale');
  // Also clean structured references left by sales that were deleted previously.
  const references = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "Sale" WHERE "storeId" = ${storeId}
    UNION SELECT "saleId" FROM "ClientPayment" WHERE "storeId" = ${storeId} AND "saleId" IS NOT NULL
    UNION SELECT "saleId" FROM "ClientDeposit" WHERE "storeId" = ${storeId} AND "saleId" IS NOT NULL
    UNION SELECT "sourceSaleId" FROM "CommissionAccrual" WHERE "storeId" = ${storeId}
    UNION SELECT "sourceId" FROM "CashMovement" WHERE "storeId" = ${storeId} AND "sourceType" = 'sale' AND "sourceId" IS NOT NULL`);
  const saleReferences = references.map(row => row.id);
  const inventory = await select('InventoryItem');
  const trades = await select('TradeIn', Prisma.sql`${inIds('id', (await tx.sale.findMany({ where: { storeId, tradeInId: { not: null } }, select: { tradeInId: true } })).map(sale => sale.tradeInId!))}
    OR ${inIds('receivedInventoryItemId', inventory)} OR ${inIds('draftProductId', inventory)} OR ${notNull('removedFromSaleNumber')}`);
  const returns = await select('ReturnCase', Prisma.sql`${notNull('saleId')} OR ${inIds('inventoryItemId', inventory)}`);
  const credits = await select('CreditNote', Prisma.sql`${notNull('saleId')} OR ${inIds('returnCaseId', returns)}`);
  await select('CreditNoteApplication', Prisma.sql`${notNull('saleId')} OR ${inIds('creditNoteId', credits)}`);
  await select('ReturnEvent', inIds('caseId', returns));
  await select('SaleInstallment');
  await select('SaleInstallmentPlan');
  await select('SaleTender');
  const deposits = await select('ClientDeposit', Prisma.sql`${notNull('saleId')}
    OR t."requestKey" = ANY(${saleReferences.flatMap(id => [`excess-${id}`, `cancel-credit-${id}`])}::text[])`);
  // Older deposit ledger rows have no saleId. These two exact server-written
  // markers identify sale effects; repair applications and deposit receipts stay.
  await select('ClientPayment', Prisma.sql`${notNull('saleId')}
    OR (t."kind" = 'APLICACION' AND t."note" = 'Seña aplicada a venta (sin nuevo cobro)')
    OR (t."kind" = 'CREDITO' AND t."note" = 'Seña disponible por cancelación de venta (sin devolución)')`);
  await select('CommissionAccrual'); // All accruals have a non-null sourceSaleId.
  await select('CashMovement', Prisma.sql`t."sourceType" = 'sale'
    OR (t."sourceType" = 'return' AND ${inIds('sourceId', returns)})
    OR (t."sourceType" = 'deposit' AND ${inIds('sourceId', deposits)})`);
  await includeCashReversals(tx, storeId, plan);
  await select('StockCountScan');
  await select('StockCountExpected');
  const stockCounts = await select('StockCount');
  const records = [...ids.Sale!, ...inventory, ...trades, ...returns, ...stockCounts];
  const notices = await select('StoreNotification', Prisma.sql`t."section" IN ('sales', 'inventory') OR ${inIds('recordId', records)}`);
  await select('NotificationRead', inIds('notificationId', notices));
  plan.SectionRecordView = Prisma.sql`t."storeId" = ${storeId} AND (t."section" IN ('sales', 'inventory') OR ${inIds('recordId', records)})`;
  return { plan, inventory };
}

async function includeCashReversals(tx: Tx, storeId: string, plan: Plan) {
  // Legacy reversals may lack source metadata. Freeze their IDs as well.
  const reversals = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH RECURSIVE removed AS (
      SELECT t."id" FROM "CashMovement" t WHERE ${plan.CashMovement!}
      UNION SELECT c."id" FROM "CashMovement" c JOIN removed r ON c."reversalOf" = r."id" WHERE c."storeId" = ${storeId}
    ) SELECT "id" FROM removed`);
  plan.CashMovement = Prisma.sql`t."storeId" = ${storeId} AND ${inIds('id', reversals.map(row => row.id))}`;
}

async function planCashAdjustments(tx: Tx, storeId: string, plan: Plan, full: boolean) {
  const rows = await tx.$queryRaw<{ id: string; balance: Prisma.Decimal; amount: Prisma.Decimal; zero: boolean }[]>(Prisma.sql`
    SELECT r."id", r."balance",
      COALESCE((SELECT sum(t."amount") FROM "CashMovement" t WHERE ${plan.CashMovement!} AND t."registerId" = r."id"), 0) AS amount,
      (${full} AND EXISTS (SELECT 1 FROM "CashMovement" t WHERE ${plan.CashMovement!} AND (
        (t."registerId" = r."id" AND t."currency" IS NOT NULL AND t."currency" <> r."currency")
        OR (t."registerId" IS NULL AND (t."currency" IS NULL OR t."currency" = r."currency")
          AND (t."method" IS NULL OR t."method" = r."method"))
      ))) AS zero
    FROM "CashRegister" r WHERE r."storeId" = ${storeId}`);
  return rows.filter(row => row.zero || !row.amount.isZero()).map(row => ({
    id: row.id, zero: row.zero, balance: row.zero ? new Prisma.Decimal(0) : row.balance.minus(row.amount),
  }));
}

// Compare every retained row, including other tenants, globals and accounts.
// Exclude only fields explicitly adjusted below.
type MutableRows = Partial<Record<Prisma.ModelName, string[]>>;
async function retainedFingerprint(tx: Tx, plan: Plan, mutable: MutableRows) {
  const result: Record<string, unknown> = {};
  for (const model of models) {
    const excluded = model.name === 'Client' ? ['totalSpent', 'pendingBalance', 'lastPurchaseAt', 'updatedAt']
      : model.name === 'CashRegister' ? ['balance', 'updatedAt']
      : model.name === 'ClientDeposit' ? ['productId', 'updatedAt'] : [];
    // Only the exact planned IDs may change these fields. Every other retained
    // row, including clients with independent opening balances, stays exact.
    const row = excluded.length ? Prisma.sql`CASE WHEN ${inIds('id', mutable[model.name as Prisma.ModelName] ?? [])}
      THEN to_jsonb(t) - ${excluded}::text[] ELSE to_jsonb(t) END` : Prisma.sql`to_jsonb(t)`;
    result[model.name] = await tx.$queryRaw(Prisma.sql`
      SELECT count(*)::int AS count,
        md5(COALESCE(string_agg(md5((${row})::text), '' ORDER BY md5((${row})::text)), '')) AS fingerprint
      FROM ${table(model.name as Prisma.ModelName)} t WHERE NOT (${plan[model.name as Prisma.ModelName] ?? Prisma.sql`FALSE`})`);
  }
  return JSON.stringify(result);
}
// Full fingerprints of all other tenants detect Cascade/SetNull and adjustments
// through malformed cross-store FKs. Values never leave the transaction.
async function otherStores(tx: Tx, storeId: string) {
  const result: Record<string, unknown> = {};
  for (const model of tenantModels) {
    result[model.name] = await tx.$queryRaw(Prisma.sql`
      SELECT md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) AS fingerprint
      FROM ${table(model.name as Prisma.ModelName)} t WHERE t."storeId" IS DISTINCT FROM ${storeId}`);
  }
  result.NotificationRead = await tx.$queryRaw(Prisma.sql`
    SELECT md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) AS fingerprint
    FROM "NotificationRead" t JOIN "StoreNotification" n ON n."id" = t."notificationId" WHERE n."storeId" <> ${storeId}`);
  return JSON.stringify(result);
}

// Use the same attribution as account statements/cancellation: general payments
// cover oldest sales first; any balance above the sale lines is independent.
async function clientAdjustments(tx: Tx, storeId: string) {
  const store = await tx.store.findUniqueOrThrow({ where: { id: storeId }, select: { currency: true } });
  const clients = await tx.client.findMany({ where: { storeId, OR: [
    { sales: { some: { storeId } } }, { payments: { some: { storeId, saleId: { not: null } } } },
  ] }, include: { sales: { where: { storeId, voidedAt: null, status: await storedStateFilter(tx, 'Sale', storeId, ["CANCELADA","ANULADA"], true) }, include: { tradeIn: true } }, payments: { where: { storeId } } } });
  return clients.map(client => {
    const currency = client.balanceCurrency ?? store.currency;
    const convert = (amount: Prisma.Decimal, from: string | null, rate?: Prisma.Decimal | null) => {
      if ((from ?? store.currency) === currency || amount.isZero()) return amount.toDecimalPlaces(2).toNumber();
      check(!!rate?.gt(0), 'Falta cotización histórica para separar el saldo de ventas del cliente.');
      return ((from ?? store.currency) === 'USD' ? amount.mul(rate!) : amount.div(rate!)).toDecimalPlaces(2).toNumber();
    };
    const targets = client.sales.map(sale => ({
      id: sale.id, status: sale.status, soldAt: sale.soldAt.toISOString(),
      cash: Math.max(0, convert((sale.tradeIn?.differencePaid ?? sale.amount).minus(sale.depositAppliedAmount), sale.amountCurrency, sale.exchangeRate)),
      openBalance: sale.openBalance == null ? null : convert(sale.openBalance, sale.amountCurrency, sale.exchangeRate),
    }));
    // A manual charge linked to a sale is removed too. Price-rise charges are
    // already in that sale's openBalance; counting them again would eat manual debt.
    for (const row of client.payments) {
      if (!row.saleId || row.kind !== 'CARGO' || row.note === 'Diferencia por corrección de precio') continue;
      const amount = convert(row.amount, row.currency, client.sales.find(sale => sale.id === row.saleId)?.exchangeRate);
      targets.push({ id: `charge:${row.id}`, status: 'PENDIENTE', soldAt: row.paidAt.toISOString(), cash: amount, openBalance: amount });
    }
    const payments = client.payments.filter(row => ['PAGO', 'VUELTO', 'CREDITO'].includes(row.kind) && !row.repairOrderId).map(row => ({
      saleId: row.saleId, repairOrderId: row.repairOrderId, kind: row.kind,
      amount: convert(row.amount, row.currency, client.sales.find(sale => sale.id === row.saleId)?.exchangeRate),
    }));
    const salesDebt = [...balanceStillOwed(targets, payments, client.pendingBalance.toNumber()).values()].reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0));
    return { id: client.id, pendingBalance: Prisma.Decimal.max(0, client.pendingBalance.minus(salesDebt)) };
  });
}

/** Never log the body or report. All guards, effects and audit share one transaction. */
export async function resetStore(body: StoreResetBody, admin: { email: string }): Promise<Report> {
  const full = body.scope === 'full';
  const deleteModels: readonly Prisma.ModelName[] = full ? STORE_RESET_FULL_DELETE_MODELS : STORE_RESET_DELETE_MODELS;
  const keepModels = STORE_RESET_KEEP_MODELS.filter(model => !deleteModels.includes(model));
  const classified: readonly string[] = [...STORE_RESET_KEEP_MODELS, ...STORE_RESET_DELETE_MODELS];
  check(tenantModels.every(model => classified.includes(model.name)), 'Hay modelos sin clasificar; reset deshabilitado.');
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
      const stores = await tx.store.findMany({ where: { memberships: { some: {
        role: 'OWNER', removedAt: null, user: { email: { equals: body.storeEmail, mode: 'insensitive' } },
      } } }, select: { id: true, name: true } });
      check(stores.length === 1, 'El email debe identificar exactamente una tienda con OWNER activo.');
      const store = stores[0]!;
      check(store.id === body.expectStoreId, 'El ID de la tienda no coincide.');
      check(store.name === body.expectStoreName, 'El nombre de la tienda no coincide.');
      await lockCash(tx, store.id);
      const { plan, inventory } = await planReset(tx, store.id, full);
      const willDelete: Counts = {};
      const willKeep: Counts = {};
      for (const model of deleteModels) willDelete[model] = await count(tx, model, plan[model]!);
      for (const model of [...keepModels, ...deleteModels]) {
        willKeep[model] = await count(tx, model, scope(model, store.id)) - (willDelete[model] ?? 0);
      }
      if (!body.dryRun) check(sameCounts(body.expect, willDelete), 'Los conteos expect no coinciden. Volvé a ejecutar dryRun.');
      // Full owns both sides of a shared sale/repair payment or deposit.
      check(full || (await count(tx, 'ClientPayment', Prisma.sql`(${plan.ClientPayment!}) AND t."repairOrderId" IS NOT NULL`) === 0
        && await count(tx, 'ClientDeposit', Prisma.sql`(${plan.ClientDeposit!}) AND t."repairId" IS NOT NULL`) === 0),
      'Hay cobros o señas compartidos con reparaciones; revisalos antes del reset.');
      const othersBefore = await otherStores(tx, store.id);
      // Purchase aggregates are sales-derived. Keep the independent part of the
      // pending balance, imported history, identities, repairs and loose payments.
      // Full deletes clients and their ledger; it must never separate balances
      // or require a historical exchange rate, even for shared sale/repair rows.
      const affected = full ? [] : await clientAdjustments(tx, store.id);
      const depositsToRelease = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT t."id" FROM "ClientDeposit" t
        WHERE t."storeId" = ${store.id} AND ${inIds('productId', inventory)} AND NOT (${plan.ClientDeposit!})`);
      const cashAdjustments = await planCashAdjustments(tx, store.id, plan, full);
      const mutable = { Client: affected.map(row => row.id), ClientDeposit: depositsToRelease.map(row => row.id), CashRegister: cashAdjustments.map(row => row.id) };
      const keepBefore = await retainedFingerprint(tx, plan, mutable);
      for (const client of affected) await tx.client.updateMany({ where: { storeId: store.id, id: client.id },
        data: { totalSpent: 0, pendingBalance: client.pendingBalance, lastPurchaseAt: null } });
      // Retain real, unconsumed deposits; release their reference to deleted stock.
      await tx.$executeRaw(Prisma.sql`UPDATE "ClientDeposit" t SET "productId" = NULL
        WHERE t."storeId" = ${store.id} AND ${inIds('productId', inventory)} AND NOT (${plan.ClientDeposit!})`);
      // Never convert cash. Full uses zero when legacy attribution is ambiguous;
      // otherwise remove the signed net in the register's own denomination.
      for (const adjustment of cashAdjustments) await tx.$executeRaw(Prisma.sql`
        UPDATE "CashRegister" SET "balance" = ${adjustment.balance} WHERE "storeId" = ${store.id} AND "id" = ${adjustment.id}`);
      for (const model of deleteModels) {
        const deleted = await tx.$executeRaw(Prisma.sql`DELETE FROM ${table(model)} t WHERE ${plan[model]!}`);
        check(deleted === willDelete[model], `El conteo de ${model} cambió. Se revirtieron los cambios.`);
      }
      check(await tx.sale.count({ where: { storeId: store.id } }) === 0 && await tx.inventoryItem.count({ where: { storeId: store.id } }) === 0, 'Quedaron ventas o inventario.');
      if (full) for (const model of deleteModels.filter(model => !['CashMovement', 'NotificationRead', 'StoreNotification', 'SectionRecordView'].includes(model))) {
        check(await count(tx, model, scope(model, store.id)) === 0, `Quedaron registros de ${model}.`);
      }
      check(await otherStores(tx, store.id) === othersBefore, 'Cambió otra tienda. Se revirtieron los cambios.');
      const updatedClients = await tx.client.findMany({ where: { storeId: store.id, id: { in: mutable.Client } } });
      check(affected.every(expected => updatedClients.some(actual => actual.id === expected.id
        && actual.pendingBalance.equals(expected.pendingBalance) && actual.totalSpent.isZero() && actual.lastPurchaseAt === null)),
      'No se ajustaron los agregados de ventas del cliente.');
      check(await tx.clientDeposit.count({ where: { storeId: store.id, id: { in: mutable.ClientDeposit }, productId: { not: null } } }) === 0, 'Quedaron reservas de stock borrado.');
      const registers = await tx.cashRegister.findMany({ where: { storeId: store.id, id: { in: mutable.CashRegister } } });
      check(cashAdjustments.every(expected => registers.some(after => after.id === expected.id && after.balance.equals(expected.balance))), 'El saldo de caja no coincide.');
      check(await retainedFingerprint(tx, plan, mutable) === keepBefore, 'Cambió un registro preservado. Se revirtieron los cambios.');
      await writeAudit(tx, {
        storeId: store.id, action: 'store.reset', entityType: 'store', entityId: store.id, source: 'system',
        detail: JSON.stringify({ admin: admin.email, scope: body.scope ?? 'sales-inventory', willDelete, willKeep,
          clientsReset: full ? willDelete.Client : affected.length,
          ...(full ? { cashRegistersZeroed: cashAdjustments.filter(row => row.zero).length } : {}),
        }),
      });
      const result = { dryRun: body.dryRun, store, willDelete, willKeep };
      if (body.dryRun) throw new DryRunRollback(result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 30_000 });
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result;
    if (error instanceof DomainError) throw error;
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    throw new DomainError(`No se pudo vaciar ${full ? 'la operación de la tienda' : 'ventas e inventario'}. Se revirtieron los cambios.`, code === 'P2034' ? 409 : 500);
  }
}
