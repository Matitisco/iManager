import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';
import { prisma } from '../../plugins/prisma.js';
import { writeAudit } from '../audit/audit.js';

// Every tenant model must have an explicit decision. Global account/provider
// models are also listed so the report describes everything we preserve.
export const STORE_RESET_KEEP_MODELS = [
  'Store', 'User', 'StoreMember', 'StoreInvitation', 'StoreFollowUpSettings',
  'PeriodicReportSettings', 'StorePublicCatalog', 'StoreCatalogOption',
  'CustomFieldDefinition', 'ClientCategory', 'InventoryCategory', 'TradeInCategory',
  'SaleCategory', 'CommissionRule', 'CashRegister', 'BillingCheckout', 'BillingPlan',
  'AuditEvent', 'ImeiTacMiss', 'StoreCounter',
] as const satisfies readonly Prisma.ModelName[];

// FK order: children before parents, including NotificationRead (no storeId).
export const STORE_RESET_DELETE_MODELS = [
  'NotificationRead', 'SectionRecordView', 'StockCountScan', 'StockCountExpected',
  'StockCount', 'CreditNoteApplication', 'CreditNote', 'ReturnEvent', 'ReturnCase',
  'SaleInstallment', 'SaleInstallmentPlan', 'SaleTender', 'ClientDeposit',
  'ClientPayment', 'RepairStatusEvent', 'RepairOrder', 'CommissionPayment',
  'CommissionAccrual', 'CashCount', 'CashMovement', 'CashSession', 'Sale', 'TradeIn',
  'InventoryItem', 'StockPurchase', 'Supplier', 'Client', 'Expense',
  'StoreNotification', 'ProductEvent', 'PeriodicReportDelivery',
] as const satisfies readonly Prisma.ModelName[];

export const storeResetBody = z.object({
  storeId: z.string().min(1).max(160),
  storeEmail: z.string().trim().email(),
  expectStoreName: z.string(),
  dryRun: z.boolean(),
  confirm: z.string().optional(),
  expect: z.record(z.number().int().nonnegative().safe()).optional(),
}).strict();
export type StoreResetBody = z.infer<typeof storeResetBody>;
type Tx = Prisma.TransactionClient;
type Counts = Record<string, number>;
type Report = {
  dryRun: boolean;
  store: { id: string; name: string };
  willDelete: Counts;
  willKeep: Counts;
  confirmToken: string;
};
class DryRunRollback extends Error {
  constructor(public result: Report) { super('dry-run'); }
}

export function requireStoreResetTestEnvironment() {
  const name = process.env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
  if (name === 'production' || (!name && process.env.NODE_ENV === 'production')) {
    throw new DomainError('Solo disponible en ambientes de prueba', 403);
  }
}

const models = Prisma.dmmf.datamodel.models;
const tenantModels = models.filter(model => model.fields.some(field => field.name === 'storeId'));
// Identifiers come exclusively from Prisma metadata, never from a request.
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
async function counts(tx: Tx, list: readonly Prisma.ModelName[], storeId: string): Promise<Counts> {
  const result: Counts = {};
  for (const model of list) {
    const [row] = await tx.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT count(*)::int AS count FROM ${table(model)} t WHERE ${scope(model, storeId)}`);
    result[model] = row!.count;
  }
  return result;
}
function check(ok: boolean, message: string): asserts ok {
  if (!ok) throw new DomainError(message, 409);
}
function sameCounts(expected: Counts | undefined, actual: Counts) {
  return !!expected && Object.keys(expected).length === Object.keys(actual).length
    && Object.entries(actual).every(([model, count]) => Object.hasOwn(expected, model) && expected[model] === count);
}

// Fingerprints stay in the transaction, never in responses or logs. They detect
// SetNull side effects as well as cascading deletions across malformed tenant FKs.
const fingerprint = Prisma.sql`md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), ''))`;
async function otherStores(tx: Tx, storeId: string) {
  const result: Record<string, unknown> = {};
  for (const model of tenantModels) {
    result[model.name] = await tx.$queryRaw(Prisma.sql`
      SELECT t."storeId", count(*)::int AS count, ${fingerprint} AS fingerprint
      FROM ${table(model.name as Prisma.ModelName)} t WHERE t."storeId" IS DISTINCT FROM ${storeId}
      GROUP BY t."storeId" ORDER BY t."storeId" NULLS FIRST`);
  }
  result.NotificationRead = await tx.$queryRaw(Prisma.sql`
    SELECT n."storeId", count(*)::int AS count, ${fingerprint} AS fingerprint
    FROM "NotificationRead" t JOIN "StoreNotification" n ON n."id" = t."notificationId"
    WHERE n."storeId" <> ${storeId} GROUP BY n."storeId" ORDER BY n."storeId"`);
  return JSON.stringify(result);
}
async function preserved(tx: Tx, storeId: string) {
  const result: Record<string, unknown> = {};
  for (const model of STORE_RESET_KEEP_MODELS) {
    // StoreCounter preserves its row but resets the last-issued numbers to zero.
    // CashRegister preserves its definition; its business balance resets to zero.
    const row = model === 'StoreCounter' ? Prisma.sql`to_jsonb(t) - ARRAY['lastSaleNumber','lastTradeNumber','lastRepairNumber']`
      : model === 'CashRegister' ? Prisma.sql`to_jsonb(t) - ARRAY['balance','updatedAt']` : Prisma.sql`to_jsonb(t)`;
    // Protect every account/store/membership, including users without a store.
    const where = ['Store', 'User', 'StoreMember'].includes(model) ? Prisma.sql`TRUE` : scope(model, storeId);
    result[model] = await tx.$queryRaw(Prisma.sql`
      SELECT count(*)::int AS count,
        md5(COALESCE(string_agg(md5((${row})::text), '' ORDER BY md5((${row})::text)), '')) AS fingerprint
      FROM ${table(model)} t WHERE ${where}`);
  }
  return JSON.stringify(result);
}

/** Test-only destructive operation. Never log the body or report. */
export async function resetStore(body: StoreResetBody, admin: { email: string }): Promise<Report> {
  requireStoreResetTestEnvironment();
  // Independent, fail-closed tenant allowlist, before any database access.
  const allowed = new Set((process.env.STORE_RESET_ALLOWED_STORE_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean));
  if (!allowed.has(body.storeId)) throw new DomainError('Tienda no autorizada para vaciar datos de prueba.', 403);
  const classified: readonly string[] = [...STORE_RESET_KEEP_MODELS, ...STORE_RESET_DELETE_MODELS];
  check(tenantModels.every(model => classified.includes(model.name)), 'Hay modelos sin clasificar; reset deshabilitado.');
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
      const store = await tx.store.findUnique({ where: { id: body.storeId }, select: { id: true, name: true } });
      if (!store) throw new DomainError('Tienda no encontrada.', 404);
      check(store.name === body.expectStoreName, 'El nombre de la tienda no coincide.');
      const owner = await tx.storeMember.findFirst({ where: {
        storeId: store.id, role: 'OWNER', removedAt: null,
        user: { email: { equals: body.storeEmail, mode: 'insensitive' } },
      } });
      check(!!owner, 'El email no corresponde a un OWNER activo de la tienda.');
      const willDelete = await counts(tx, STORE_RESET_DELETE_MODELS, store.id);
      const willKeep = await counts(tx, STORE_RESET_KEEP_MODELS, store.id);
      const confirmToken = `VACIAR ${store.id} ${Object.values(willDelete).reduce((sum, count) => sum + count, 0)}`;
      const result = { dryRun: body.dryRun, store, willDelete, willKeep, confirmToken };
      if (!body.dryRun) {
        check(body.confirm === confirmToken, 'Confirmación ausente o desactualizada. Volvé a ejecutar dryRun.');
        check(sameCounts(body.expect, willDelete), 'Los conteos expect no coinciden. Volvé a ejecutar dryRun.');
      }
      const othersBefore = await otherStores(tx, store.id);
      const keepBefore = await preserved(tx, store.id);
      for (const model of STORE_RESET_DELETE_MODELS) {
        await tx.$executeRaw(Prisma.sql`DELETE FROM ${table(model)} t WHERE ${scope(model, store.id)}`);
      }
      await tx.storeCounter.updateMany({ where: { storeId: store.id }, data: { lastSaleNumber: 0, lastTradeNumber: 0, lastRepairNumber: 0 } });
      await tx.cashRegister.updateMany({ where: { storeId: store.id }, data: { balance: 0 } });
      check(await tx.storeCounter.count({ where: { storeId: store.id, OR: [{ lastSaleNumber: { not: 0 } }, { lastTradeNumber: { not: 0 } }, { lastRepairNumber: { not: 0 } }] } }) === 0, 'No se reinició la numeración.');
      check(await tx.cashRegister.count({ where: { storeId: store.id, balance: { not: 0 } } }) === 0, 'No se reiniciaron los saldos de caja.');
      check(Object.values(await counts(tx, STORE_RESET_DELETE_MODELS, store.id)).every(count => count === 0), 'Quedaron datos de negocio. Se revirtieron los cambios.');
      check(await otherStores(tx, store.id) === othersBefore, 'Cambió otra tienda. Se revirtieron los cambios.');
      check(await preserved(tx, store.id) === keepBefore, 'Cambió una cuenta o configuración. Se revirtieron los cambios.');
      await writeAudit(tx, {
        storeId: store.id, action: 'store.reset', entityType: 'store', entityId: store.id, source: 'system',
        // The platform admin need not have a local User. Do not attribute the reset to the owner.
        detail: JSON.stringify({ admin: admin.email, willDelete, willKeep, reset: { StoreCounter: 0, CashRegisterBalance: 0 } }),
      });
      if (body.dryRun) throw new DryRunRollback(result);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 30_000 });
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result;
    if (error instanceof DomainError) throw error;
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    throw new DomainError('No se pudo vaciar la tienda. Se revirtieron los cambios.', code === 'P2034' ? 409 : 500);
  }
}
