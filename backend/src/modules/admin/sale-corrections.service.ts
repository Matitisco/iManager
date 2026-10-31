/**
 * POST /admin/sale-corrections { dryRun: true|false, ... } corrects sales whose
 * amount was stored for one unit (or otherwise wrong) and, optionally, the sold
 * product's price/cost. It goes through the same edit path as the app
 * (updateSaleOperationInTx), so client totals, commissions, debt ledger, cash
 * and audit stay consistent, and stock is never touched.
 *
 * - Nothing is guessed: every sale carries expect* guards (current amount,
 *   quantity, status, model). Any mismatch aborts with 409 and writes nothing.
 * - The new amount is given explicitly as `newTotal` OR `unitPrice` (× quantity), never both.
 * - dryRun runs the whole correction and its post-condition checks inside the
 *   transaction and then rolls back, so the preview is exactly what apply does.
 * - Apply is a single serializable transaction. Any failed check rolls back everything.
 * - Only increases are supported (a decrease would be a refund, a different flow).
 * - The response carries `backup` (before-state of every touched row + ids created).
 *   Never log it. Keep a Railway Postgres snapshot before applying in production.
 */
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';
import { prisma } from '../../plugins/prisma.js';
import { updateSaleOperationInTx } from '../operations/operations.service.js';
import { writeAudit, type Actor } from '../audit/audit.js';

type Tx = Prisma.TransactionClient;
const money = z.number().finite().min(0).max(100_000_000);

const productFix = z.object({
  expectPrice: money.nullable(),
  expectCost: money,
  expectCurrency: z.string().length(3).nullable(),
  price: money.optional(),
  cost: money.optional(),
  currency: z.string().length(3).optional(),
}).strict().refine(p => p.price !== undefined || p.cost !== undefined || p.currency !== undefined, { message: 'product: indicá price, cost o currency.' });

const saleFix = z.object({
  saleNumber: z.number().int().min(1),
  expectModel: z.string().min(1),
  expectQuantity: z.number().int().min(1),
  expectAmount: money,
  expectStatus: z.enum(['COMPLETADA', 'PENDIENTE']),
  newTotal: money.positive().optional(),
  unitPrice: money.positive().optional(),
  // true: the extra money was really received (records cash + payment). false: leave it as client debt.
  collectDifference: z.boolean().optional(),
  product: productFix.optional(),
}).strict().superRefine((s, ctx) => {
  const has = Number(s.newTotal !== undefined) + Number(s.unitPrice !== undefined);
  if (has > 1) ctx.addIssue({ code: 'custom', message: 'Indicá newTotal o unitPrice, no ambos.' });
  if (has === 0 && !s.product) ctx.addIssue({ code: 'custom', message: 'Nada que corregir: indicá newTotal, unitPrice o product.' });
  if (has === 1 && s.collectDifference === undefined) ctx.addIssue({ code: 'custom', message: 'collectDifference es obligatorio al cambiar el monto.' });
});

export const saleCorrectionsBody = z.object({
  storeEmail: z.string().trim().email(),
  expectStoreName: z.string(),
  expectStoreCurrency: z.string().length(3),
  dryRun: z.boolean(),
  sales: z.array(saleFix).min(1).max(50)
    .refine(list => new Set(list.map(s => s.saleNumber)).size === list.length, { message: 'saleNumber repetido.' }),
}).strict();
export type SaleCorrectionsBody = z.infer<typeof saleCorrectionsBody>;

const writeOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000, maxWait: 30_000 };
class DryRunRollback extends Error { constructor(public result: unknown) { super('dry-run'); } }

function expectEqual(field: string, expected: unknown, actual: unknown): void {
  if (expected !== actual) throw new DomainError(`${field}: esperado ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`, 409);
}
const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));
const r2 = (n: number) => Math.round(n * 100) / 100;

async function resolveStore(tx: Tx, body: SaleCorrectionsBody) {
  const stores = await tx.$queryRaw<{ id: string; name: string; currency: string; ownerId: string }[]>(Prisma.sql`
    SELECT DISTINCT s."id", s."name", s."currency", u."id" AS "ownerId" FROM "Store" s
    JOIN "StoreMember" m ON m."storeId" = s."id" AND m."removedAt" IS NULL AND m."role"::text = 'OWNER'
    JOIN "User" u ON u."id" = m."userId" WHERE lower(u."email") = lower(${body.storeEmail})`);
  if (stores.length !== 1) throw new DomainError(`Se esperaba exactamente 1 tienda y se encontraron ${stores.length}.`, stores.length === 0 ? 404 : 409);
  const store = stores[0]!;
  expectEqual('nombre de tienda', body.expectStoreName, store.name);
  expectEqual('moneda de tienda', body.expectStoreCurrency, store.currency);
  return store;
}

const CREATED_TABLES = ['ClientPayment', 'CashMovement', 'AuditEvent', 'StoreNotification'] as const;
async function idsOf(tx: Tx, table: string, storeId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} WHERE "storeId" = ${storeId}`);
  return new Set(rows.map(r => r.id));
}
async function rowsOf(tx: Tx, table: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx.$queryRaw<{ row: unknown }[]>(Prisma.sql`SELECT to_jsonb(t) AS row FROM ${Prisma.raw(`"${table}"`)} t WHERE t."id" IN (${Prisma.join(ids)}) ORDER BY t."id"`);
  return rows.map(r => r.row);
}

export async function correctSales(body: SaleCorrectionsBody, admin: { email: string }): Promise<Record<string, any>> {
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
      const store = await resolveStore(tx, body);
      const actor: Actor = { userId: store.ownerId, name: `Corrección admin (${admin.email})`.slice(0, 255) };

      // 1. Read and validate everything before the first write.
      const sales = await tx.sale.findMany({ where: { storeId: store.id, saleNumber: { in: body.sales.map(s => s.saleNumber) } } });
      expectEqual('ventas encontradas', body.sales.length, sales.length);
      const bySale = new Map(sales.map(s => [s.saleNumber, s]));
      const items = await tx.inventoryItem.findMany({ where: { id: { in: sales.flatMap(s => (s.inventoryItemId ? [s.inventoryItemId] : [])) } } });
      const itemById = new Map(items.map(i => [i.id, i]));
      const clientIds = [...new Set(sales.flatMap(s => (s.clientId ? [s.clientId] : [])))];
      const clients = await tx.client.findMany({ where: { id: { in: clientIds } } });

      type Plan = { fix: z.infer<typeof saleFix>; sale: (typeof sales)[number]; item: (typeof items)[number] | null; target: number; changesAmount: boolean };
      const plans: Plan[] = body.sales.map(fix => {
        const sale = bySale.get(fix.saleNumber)!;
        const code = `V-${String(sale.saleNumber).padStart(4, '0')}`;
        if (sale.voidedAt || sale.status === 'CANCELADA') throw new DomainError(`${code}: anulada o cancelada.`, 409);
        expectEqual(`${code} cantidad`, fix.expectQuantity, sale.cantidad);
        expectEqual(`${code} monto actual`, fix.expectAmount, num(sale.amount));
        expectEqual(`${code} estado`, fix.expectStatus, sale.status);
        expectEqual(`${code} moneda de la venta`, store.currency, sale.amountCurrency ?? store.currency);
        const item = sale.inventoryItemId ? itemById.get(sale.inventoryItemId) ?? null : null;
        if (!item) throw new DomainError(`${code}: la venta no tiene producto de inventario.`, 409);
        if (!(item.model + ' ' + item.capacity + ' ' + (sale.deviceLabel ?? '')).toLowerCase().includes(fix.expectModel.toLowerCase())) {
          throw new DomainError(`${code} modelo: esperado «${fix.expectModel}», actual «${item.model} ${item.capacity}».`, 409);
        }
        const target = fix.newTotal ?? (fix.unitPrice !== undefined ? r2(fix.unitPrice * sale.cantidad) : num(sale.amount)!);
        const changesAmount = fix.newTotal !== undefined || fix.unitPrice !== undefined;
        if (changesAmount && target < num(sale.amount)!) throw new DomainError(`${code}: solo se admiten aumentos (${num(sale.amount)} → ${target}).`, 409);
        if (fix.product) {
          expectEqual(`${code} precio actual del producto`, fix.product.expectPrice, num(item.price));
          expectEqual(`${code} costo actual del producto`, fix.product.expectCost, num(item.cost));
          expectEqual(`${code} moneda actual del producto`, fix.product.expectCurrency, item.currency ?? null);
        }
        return { fix, sale, item, target, changesAmount };
      });
      const itemIdsSeen = plans.map(p => p.item!.id);
      expectEqual('productos distintos', itemIdsSeen.length, new Set(itemIdsSeen).size);

      // 2. Backup (before-state) and baseline for post-conditions.
      const before = { ids: {} as Record<string, Set<string>> };
      for (const t of CREATED_TABLES) before.ids[t] = await idsOf(tx, t, store.id);
      const registers = await tx.cashRegister.findMany({ where: { storeId: store.id } });
      const backup = {
        meta: { storeId: store.id, storeName: store.name, createdAt: new Date().toISOString(), tables: ['Sale', 'InventoryItem', 'Client', 'CashRegister'] },
        Sale: await rowsOf(tx, 'Sale', sales.map(s => s.id)),
        InventoryItem: await rowsOf(tx, 'InventoryItem', items.map(i => i.id)),
        Client: await rowsOf(tx, 'Client', clientIds),
        CashRegister: await rowsOf(tx, 'CashRegister', registers.map(r => r.id)),
        created: {} as Record<string, string[]>,
      };
      const clientBefore = new Map(clients.map(c => [c.id, { totalSpent: num(c.totalSpent)!, pendingBalance: num(c.pendingBalance)! }]));

      // 3. Apply through the app's own edit path.
      for (const p of plans) {
        const { fix, sale, item } = p;
        if (p.changesAmount && p.target > num(sale.amount)!) {
          await updateSaleOperationInTx(tx, store.id, sale.id, { amount: p.target }, actor);
          if (fix.collectDifference) await updateSaleOperationInTx(tx, store.id, sale.id, { status: 'COMPLETADA' }, actor);
        }
        if (fix.product) {
          const priceChanges = fix.product.price !== undefined && fix.product.price !== num(item!.price);
          const costChanges = fix.product.cost !== undefined && fix.product.cost !== num(item!.cost);
          const data: Prisma.InventoryItemUpdateInput = {};
          const now = new Date();
          if (priceChanges) { data.price = fix.product.price!; data.priceChangedBy = actor.name; data.priceChangedAt = now; }
          if (costChanges) { data.cost = fix.product.cost!; data.costChangedBy = actor.name; data.costChangedAt = now; }
          if (fix.product.currency !== undefined) data.currency = fix.product.currency;
          if (Object.keys(data).length) {
            await tx.inventoryItem.update({ where: { id: item!.id }, data });
            const label = `${item!.model} ${item!.capacity}`.trim();
            if (priceChanges) await writeAudit(tx, { storeId: store.id, actor, action: 'inventory.price', entityType: 'inventory', entityId: item!.id, entityLabel: label, detail: `${num(item!.price) ?? 'A definir'} → ${fix.product.price}`, source: 'system' });
            if (costChanges) await writeAudit(tx, { storeId: store.id, actor, action: 'inventory.cost', entityType: 'inventory', entityId: item!.id, entityLabel: label, detail: `${num(item!.cost)} → ${fix.product.cost}`, source: 'system' });
          }
        }
      }

      // 4. Post-conditions (rollback on any failure) and the report.
      const salesAfter = new Map((await tx.sale.findMany({ where: { id: { in: sales.map(s => s.id) } } })).map(s => [s.id, s]));
      const itemsAfter = new Map((await tx.inventoryItem.findMany({ where: { id: { in: items.map(i => i.id) } } })).map(i => [i.id, i]));
      const report = plans.map(p => {
        const code = `V-${String(p.sale.saleNumber).padStart(4, '0')}`;
        const s = salesAfter.get(p.sale.id)!;
        const i = itemsAfter.get(p.item!.id)!;
        expectEqual(`${code} cantidad vendida sin cambios`, p.sale.cantidad, s.cantidad);
        expectEqual(`${code} stock sin cambios`, p.item!.cantidad, i.cantidad);
        expectEqual(`${code} estado del stock sin cambios`, p.item!.status, i.status);
        expectEqual(`${code} monto final`, p.target, num(s.amount));
        if (p.changesAmount) {
          expectEqual(`${code} estado final`, p.fix.collectDifference ? 'COMPLETADA' : (p.target > num(p.sale.amount)! && p.sale.clientId ? 'PENDIENTE' : p.sale.status), s.status);
          if (p.fix.collectDifference) expectEqual(`${code} saldo abierto final`, 0, num(s.openBalance) ?? 0);
        }
        const cost = num(i.cost) ?? 0;
        return {
          sale: code, quantity: s.cantidad,
          amount: { before: num(p.sale.amount), after: num(s.amount) }, status: { before: p.sale.status, after: s.status },
          openBalance: { before: num(p.sale.openBalance), after: num(s.openBalance) },
          unitPriceImplied: r2(num(s.amount)! / s.cantidad),
          stock: { before: p.item!.cantidad, after: i.cantidad },
          product: { price: { before: num(p.item!.price), after: num(i.price) }, cost: { before: num(p.item!.cost), after: num(i.cost) }, currency: { before: p.item!.currency, after: i.currency } },
          profit: { before: r2(num(p.sale.amount)! - num(p.item!.cost)! * p.sale.cantidad), after: r2(num(s.amount)! - cost * s.cantidad), note: 'amount − cost × quantity, using the product currency as stored' },
        };
      });
      const clientsAfter = await tx.client.findMany({ where: { id: { in: clientIds } } });
      const clientReport = clientsAfter.map(c => ({ clientId: c.id, totalSpent: { before: clientBefore.get(c.id)!.totalSpent, after: num(c.totalSpent) }, pendingBalance: { before: clientBefore.get(c.id)!.pendingBalance, after: num(c.pendingBalance) } }));
      const increase = plans.reduce((sum, p) => sum + (p.changesAmount ? p.target - num(p.sale.amount)! : 0), 0);
      const owedDelta = plans.reduce((sum, p) => sum + (p.changesAmount && !p.fix.collectDifference && p.sale.clientId ? p.target - num(p.sale.amount)! : 0), 0);
      expectEqual('totalSpent de clientes', r2(clients.reduce((sum, c) => sum + num(c.totalSpent)!, 0) + increase), r2(clientsAfter.reduce((sum, c) => sum + num(c.totalSpent)!, 0)));
      expectEqual('deuda pendiente de clientes', r2(clients.reduce((sum, c) => sum + num(c.pendingBalance)!, 0) + owedDelta), r2(clientsAfter.reduce((sum, c) => sum + num(c.pendingBalance)!, 0)));
      for (const t of CREATED_TABLES) {
        const now = await idsOf(tx, t, store.id);
        backup.created[t] = [...now].filter(id => !before.ids[t]!.has(id));
      }
      const result = { store: { id: store.id, name: store.name, currency: store.currency }, dryRun: body.dryRun, applied: !body.dryRun, sales: report, clients: clientReport, increaseTotal: r2(increase), createdRows: Object.fromEntries(Object.entries(backup.created).map(([k, v]) => [k, v.length])), backup };
      if (body.dryRun) throw new DryRunRollback(result);
      return result;
    }, writeOptions);
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result as Record<string, any>;
    if (error instanceof DomainError) throw error;
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    throw new DomainError('No se pudo completar la corrección. Se revirtieron los cambios.', code === 'P2034' ? 409 : 500, code ? { prismaCode: code } : undefined);
  }
}
