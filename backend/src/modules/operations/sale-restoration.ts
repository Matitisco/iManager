import { Prisma, type Sale, type TradeIn, type InventoryItem } from '@prisma/client';
import { z } from 'zod';
import { DomainError } from '../../lib/domain-error.js';
import { writeAudit, type Actor } from '../audit/audit.js';
import { restoreCashMovements } from '../cash/service.js';

type Tx = Prisma.TransactionClient;
const stockState = (item: InventoryItem) => ({ id: item.id, cantidad: item.cantidad, status: item.status, pendingSaleRegistration: item.pendingSaleRegistration, archivedAt: item.archivedAt?.toISOString() ?? null });
const stockSchema = z.object({ cantidad: z.number().int().nonnegative().optional(), id: z.string(), status: z.string(), pendingSaleRegistration: z.boolean(), archivedAt: z.string().nullable() });
const snapshotSchema = z.object({
  status: z.string(), openBalance: z.string().nullable(),
  stock: z.array(z.object({ before: stockSchema, after: stockSchema })),
  trade: z.object({ id: z.string(), status: z.string(), confirmationStatus: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']) }).nullable(),
  client: z.object({ id: z.string(), total: z.string(), debt: z.string(), currency: z.string().nullable() }).nullable(),
  deposits: z.array(z.object({ id: z.string(), cancelledAt: z.string().nullable(), updatedAt: z.string() })),
  credits: z.array(z.object({ id: z.string(), updatedAt: z.string() })),
  payments: z.array(z.string()), cash: z.array(z.string()), commissions: z.array(z.string()),
});
type Snapshot = z.infer<typeof snapshotSchema>;

/** Record deltas owned by cancellation, preserving later changes to the client. */
export async function captureSaleCancellation(tx: Tx, sale: Sale, trade?: TradeIn | null) {
  const storeId = sale.storeId;
  const paymentWhere = { storeId, ...(sale.clientId ? { clientId: sale.clientId } : { saleId: sale.id }) };
  const [stock, client, deposits, payments, cash, commissions] = await Promise.all([
    tx.inventoryItem.findMany({ where: { storeId, id: { in: [sale.inventoryItemId, trade?.receivedInventoryItemId].filter((id): id is string => Boolean(id)) } } }),
    sale.clientId ? tx.client.findFirst({ where: { id: sale.clientId, storeId } }) : null,
    tx.clientDeposit.findMany({ where: { storeId, saleId: sale.id, status: 'APPLIED' } }),
    tx.clientPayment.findMany({ where: paymentWhere, select: { id: true } }),
    tx.cashMovement.findMany({ where: { storeId, sourceType: 'sale', sourceId: sale.id, voidedAt: null, reversalOf: null } }),
    tx.commissionAccrual.findMany({ where: { storeId, sourceSaleId: sale.id, voidedAt: null }, select: { id: true } }),
  ]);
  const reversals = await tx.cashMovement.findMany({ where: { storeId, reversalOf: { in: cash.map(row => row.id) } }, select: { reversalOf: true } });
  const reversed = new Set(reversals.map(row => row.reversalOf));
  return async () => {
    const [afterStock, afterClient, afterDeposits, afterPayments, credits] = await Promise.all([
      tx.inventoryItem.findMany({ where: { storeId, id: { in: stock.map(row => row.id) } } }),
      client ? tx.client.findFirst({ where: { id: client.id, storeId } }) : null,
      tx.clientDeposit.findMany({ where: { storeId, id: { in: deposits.map(row => row.id) } } }),
      tx.clientPayment.findMany({ where: { ...paymentWhere, id: { notIn: payments.map(row => row.id) } }, select: { id: true } }),
      tx.clientDeposit.findMany({ where: { storeId, requestKey: `cancel-credit-${sale.id}` } }),
    ]);
    const snapshot: Snapshot = {
      status: sale.status, openBalance: sale.openBalance?.toString() ?? null,
      stock: stock.map(before => ({ before: stockState(before), after: stockState(afterStock.find(row => row.id === before.id)!) })),
      trade: trade ? { id: trade.id, status: trade.status, confirmationStatus: trade.confirmationStatus! } : null,
      client: client && afterClient ? { id: client.id, total: client.totalSpent.sub(afterClient.totalSpent).toString(), debt: client.pendingBalance.sub(afterClient.pendingBalance).toString(), currency: client.balanceCurrency } : null,
      deposits: deposits.map(row => ({ id: row.id, cancelledAt: row.cancelledAt?.toISOString() ?? null, updatedAt: afterDeposits.find(after => after.id === row.id)!.updatedAt.toISOString() })),
      credits: credits.map(row => ({ id: row.id, updatedAt: row.updatedAt.toISOString() })),
      payments: afterPayments.map(row => row.id), cash: cash.filter(row => !reversed.has(row.id)).map(row => row.id), commissions: commissions.map(row => row.id),
    };
    await tx.sale.update({ where: { id: sale.id }, data: { cancellationSnapshot: snapshot } });
  };
}

function conflict(message: string): never { throw new DomainError(message, 409); }

/** Legacy voids can be restored only when retained records establish the prior state. */
async function historicalSnapshot(tx: Tx, sale: Sale): Promise<Snapshot> {
  const storeId = sale.storeId;
  const [audit, payments, deposits, commissions, cash] = await Promise.all([
    tx.auditEvent.findFirst({ where: { storeId, entityId: sale.id, action: 'sale.voided' }, orderBy: { createdAt: 'desc' } }),
    tx.clientPayment.findMany({ where: { storeId, saleId: sale.id } }),
    tx.clientDeposit.findMany({ where: { storeId, saleId: sale.id } }),
    tx.commissionAccrual.findMany({ where: { storeId, sourceSaleId: sale.id, voidReason: { in: ['CANCELLED', 'DELETED'] } }, orderBy: { createdAt: 'desc' } }),
    tx.cashMovement.findMany({ where: { storeId, sourceType: 'sale', sourceId: sale.id, reversalOf: null } }),
  ]);
  const changes = z.array(z.object({ field: z.string(), before: z.string().nullable() }).passthrough()).safeParse(audit?.changes);
  let status = changes.success ? changes.data.find(row => row.field === 'status')?.before : null;
  if (status && ['CANCELADA', 'ANULADA'].includes(status)) status = null;
  const due = Number(sale.amount) - Number(sale.depositAppliedAmount);
  const collected = payments.reduce((sum, row) => sum + (row.kind === 'PAGO' ? Number(row.amount) : row.kind === 'VUELTO' ? -Number(row.amount) : 0), 0);
  if (!status && sale.integratedOperation && due >= 0 && collected >= due && payments.every(row => !row.currency || !sale.amountCurrency || row.currency === sale.amountCurrency)) status = 'COMPLETADA';
  if (!status && !['CANCELADA', 'ANULADA'].includes(sale.status)) status = sale.status;
  if (!status || status === 'PENDIENTE' || deposits.length || sale.tradeInId || Number(sale.depositAppliedAmount)) conflict('Esta anulación histórica no conserva el estado previo completo. No se puede revertir de forma segura.');
  const reversedCash = await tx.cashMovement.findMany({ where: { storeId, reversalOf: { in: cash.map(row => row.id) } } });
  const cancellationTime = sale.cancelledAt ?? sale.voidedAt;
  // A legacy operation may also have older financial edits. Never collect their reversals again.
  if (reversedCash.some(row => !cancellationTime || Math.abs(row.createdAt.getTime() - cancellationTime.getTime()) > 60_000)) conflict('La venta histórica tiene movimientos previos que no se pueden reconstruir de forma segura.');
  const stock = sale.inventoryItemId ? await tx.inventoryItem.findFirst({ where: { id: sale.inventoryItemId, storeId } }) : null;
  if (stock && (stock.status !== 'DISPONIBLE' || stock.archivedAt || stock.pendingSaleRegistration)) conflict('No se puede revertir: el equipo histórico ya no está disponible.');
  const client = sale.clientId ? await tx.client.findFirst({ where: { id: sale.clientId, storeId } }) : null;
  let amount = sale.amount;
  if (client && sale.amountCurrency && client.balanceCurrency && sale.amountCurrency !== client.balanceCurrency) {
    if (!sale.exchangeRate?.gt(0)) conflict('La venta histórica no conserva su cotización.');
    amount = sale.amountCurrency === 'USD' ? amount.mul(sale.exchangeRate!) : amount.div(sale.exchangeRate!);
  }
  return { status, openBalance: sale.openBalance == null ? null : '0', stock: stock ? [{ before: { ...stockState(stock), status: 'VENDIDO', pendingSaleRegistration: false, archivedAt: null }, after: stockState(stock) }] : [], trade: null,
    client: client ? { id: client.id, total: amount.toFixed(2), debt: '0', currency: client.balanceCurrency } : null,
    deposits: [], credits: [], payments: payments.filter(row => row.kind === 'DEVOLUCION' && row.note?.startsWith('Devolución por cancelación de')).map(row => row.id), cash: reversedCash.map(row => row.reversalOf!), commissions: commissions.slice(0, 1).map(row => row.id) };
}

export async function restoreCancelledSale(tx: Tx, sale: Sale, actor: Actor) {
  const parsed = snapshotSchema.safeParse(sale.cancellationSnapshot);
  if (sale.cancellationSnapshot != null && !parsed.success) conflict('El estado previo de esta anulación está incompleto.');
  const snapshot = parsed.success ? parsed.data : await historicalSnapshot(tx, sale);
  const storeId = sale.storeId;
  for (const row of snapshot.stock) {
    await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${row.before.id} AND "storeId" = ${storeId} FOR UPDATE`;
    const current = await tx.inventoryItem.findFirst({ where: { id: row.before.id, storeId } });
    if (!current || (current.status !== row.after.status || current.pendingSaleRegistration !== row.after.pendingSaleRegistration || (current.archivedAt?.toISOString() ?? null) !== row.after.archivedAt || row.after.cantidad !== undefined && current.cantidad !== row.after.cantidad) || current.reservedDepositId || current.imei && await tx.sale.findFirst({ where: { storeId, inventoryItemId: row.before.id, id: { not: sale.id }, voidedAt: null, status: { notIn: ['CANCELADA', 'ANULADA'] } } })) conflict('No se puede revertir: un equipo ya se vendió, se reservó o cambió de estado.');
  }
  if (sale.clientId && !snapshot.client || sale.inventoryItemId && !snapshot.stock.some(row => row.before.id === sale.inventoryItemId)) conflict('La operación perdió un registro asociado.');
  for (const row of [...snapshot.deposits, ...snapshot.credits]) {
    const deposit = await tx.clientDeposit.findFirst({ where: { id: row.id, storeId } });
    if (!deposit || deposit.status !== 'CREDIT' || deposit.updatedAt.toISOString() !== row.updatedAt || deposit.saleId && deposit.saleId !== sale.id || deposit.repairId) conflict('No se puede revertir: una seña o saldo a favor ya fue utilizado o modificado.');
  }
  if (snapshot.client) {
    const client = await tx.client.findFirst({ where: { id: snapshot.client.id, storeId } });
    if (!client || client.archivedAt || client.balanceCurrency !== snapshot.client.currency) conflict('El cliente está archivado o cambió la moneda de su cuenta.');
    await tx.client.update({ where: { id: client.id }, data: { totalSpent: { increment: snapshot.client.total }, pendingBalance: { increment: snapshot.client.debt } } });
  }
  for (const row of snapshot.stock) await tx.inventoryItem.update({ where: { id: row.before.id }, data: { ...(row.before.cantidad === undefined ? {} : { cantidad: row.before.cantidad }), status: row.before.status, pendingSaleRegistration: row.before.pendingSaleRegistration, archivedAt: row.before.archivedAt ? new Date(row.before.archivedAt) : null } });
  if (snapshot.trade) {
    const trade = await tx.tradeIn.findFirst({ where: { id: snapshot.trade.id, storeId } });
    if (!trade || trade.confirmationStatus !== 'CANCELLED' || trade.receivedInventoryItemId && !snapshot.stock.some(row => row.before.id === trade.receivedInventoryItemId) || await tx.sale.findFirst({ where: { storeId, tradeInId: snapshot.trade.id, id: { not: sale.id } } })) conflict('El canje asociado cambió.');
    await tx.tradeIn.update({ where: { id: trade.id }, data: { status: snapshot.trade.status, confirmationStatus: snapshot.trade.confirmationStatus, voidedAt: null, voidedBy: null, voidReason: null, cancelledAt: null, cancelledBy: null } });
    await writeAudit(tx, { storeId, actor, action: 'trade.restored', entityType: 'trade', entityId: trade.id });
  }
  for (const row of snapshot.deposits) await tx.clientDeposit.update({ where: { id: row.id }, data: { status: 'APPLIED', cancelledAt: row.cancelledAt ? new Date(row.cancelledAt) : null } });
  for (const row of snapshot.credits) await tx.clientDeposit.update({ where: { id: row.id }, data: { status: 'REVERSED', requestKey: `reversed-${row.id}` } });
  // Preserve the ledger and compensate cancellation entries; collections stay untouched.
  const payments = await tx.clientPayment.findMany({ where: { storeId, id: { in: snapshot.payments } } });
  for (const row of payments) await tx.clientPayment.create({ data: { storeId, clientId: row.clientId, saleId: row.saleId, amount: row.amount.neg(), currency: row.currency, method: row.method, kind: row.kind, note: 'Reversión de anulación de venta' } });
  await restoreCashMovements(tx, storeId, snapshot.cash, actor);
  await tx.commissionAccrual.updateMany({ where: { storeId, id: { in: snapshot.commissions }, sourceSaleId: sale.id, voidReason: { in: ['CANCELLED', 'DELETED'] } }, data: { voidedAt: null, voidReason: null, adjustmentPeriod: null } });
  const restored = await tx.sale.update({ where: { id: sale.id }, data: { status: snapshot.status, openBalance: snapshot.openBalance, ...(snapshot.trade ? { tradeInId: snapshot.trade.id } : {}), voidedAt: null, voidedBy: null, voidReason: null, cancelledAt: null, cancelledBy: null, cancellationSnapshot: Prisma.DbNull } });
  if (snapshot.client) {
    const latest = await tx.sale.aggregate({ where: { storeId, clientId: snapshot.client.id, voidedAt: null, status: { notIn: ['CANCELADA', 'ANULADA'] } }, _max: { soldAt: true } });
    await tx.client.update({ where: { id: snapshot.client.id }, data: { lastPurchaseAt: latest._max.soldAt } });
  }
  await writeAudit(tx, { storeId, actor, action: 'sale.restored', entityType: 'sale', entityId: sale.id, changes: [{ field: 'status', label: 'Estado', before: 'Anulada', after: snapshot.status }] });
  return { sale: restored, inventory: await tx.inventoryItem.findMany({ where: { storeId, id: { in: snapshot.stock.map(row => row.before.id) } } }), client: snapshot.client ? await tx.client.findFirst({ where: { id: snapshot.client.id, storeId } }) : null, trade: snapshot.trade ? await tx.tradeIn.findFirst({ where: { id: snapshot.trade.id, storeId } }) : null };
}
