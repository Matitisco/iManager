import { recordCash } from '../cash/service.js';
import { Prisma, type ClientDeposit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';
import { withSerializableRetry } from '../../lib/with-serializable-retry.js';
import { storeCurrency } from '../../lib/money-currency.js';
import { writeAudit, type Actor } from '../audit/audit.js';
import { depositValue } from './deposit-money.js';

export type DepositInput = { amount: number; currency: 'ARS' | 'USD'; exchangeRate: number; method: string; productId?: string | null; requestKey: string };
const available = ['ACTIVE', 'CREDIT'];
export const clearReservation = { reservedDepositId: null, reservedClientId: null, reservedClientName: null, reservedAt: null };
export function serializeDeposit(row: ClientDeposit) {
  return { ...row, amount: Number(row.amount), exchangeRate: Number(row.exchangeRate), usdAmount: Number(row.usdAmount),
    appliedAmount: row.appliedAmount == null ? null : Number(row.appliedAmount),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null };
}
export async function listDeposits(storeId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, storeId }, select: { id: true } });
  if (!client) throw new DomainError('Cliente no encontrado', 404);
  return (await prisma.clientDeposit.findMany({ where: { storeId, clientId }, orderBy: { createdAt: 'desc' } })).map(serializeDeposit);
}
async function movement(tx: Prisma.TransactionClient, row: ClientDeposit, kind: string, note: string, amount = row.amount, currency = row.currency) {
  await tx.clientPayment.create({ data: { storeId: row.storeId, clientId: row.clientId, amount, currency, method: row.method, kind, note: note.slice(0, 200) } });
}
async function audit(tx: Prisma.TransactionClient, row: ClientDeposit, actor: Actor | undefined, action: string, detail: string) {
  if (actor) await writeAudit(tx, { storeId: row.storeId, actor, action: `deposit.${action}`, entityType: 'client', entityId: row.clientId, detail: `Seña ${row.id}: ${detail}` });
}
// Lock the same inventory row used by sales/edits so a reservation cannot be bypassed by a concurrent writer.
export async function lockInventory(tx: Prisma.TransactionClient, storeId: string, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "InventoryItem" WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`);
}
export async function createDeposit(storeId: string, clientId: string, input: DepositInput, actor?: Actor) {
  return withSerializableRetry(async (tx) => {
    const prior = await tx.clientDeposit.findFirst({ where: { storeId, requestKey: input.requestKey } });
    if (prior) {
      if (prior.clientId !== clientId || Number(prior.amount) !== input.amount || prior.currency !== input.currency || Number(prior.exchangeRate) !== input.exchangeRate || prior.method !== input.method || prior.productId !== (input.productId || null)) throw new DomainError('La solicitud ya corresponde a otra seña', 409);
      return serializeDeposit(prior);
    }
    const client = await tx.client.findFirst({ where: { id: clientId, storeId } });
    if (!client) throw new DomainError('Cliente no encontrado', 404);
    if (input.productId) await lockInventory(tx, storeId, input.productId);
    const product = input.productId ? await tx.inventoryItem.findFirst({ where: { id: input.productId, storeId, archivedAt: null } }) : null;
    if (input.productId && !product) throw new DomainError('Equipo no encontrado', 404);
    if (product && (product.reservedDepositId || product.status && product.status !== 'DISPONIBLE' || await tx.sale.findFirst({ where: { storeId, inventoryItemId: product.id, status: { not: 'CANCELADA' } }, select: { id: true } }))) throw new DomainError('El equipo no está disponible para reservar', 409);
    const amount = new Decimal(input.amount).toDecimalPlaces(2);
    const rate = new Decimal(input.exchangeRate).toDecimalPlaces(2);
    if (!amount.gt(0) || !rate.gt(0)) throw new DomainError('Monto y cotización deben ser mayores a cero');
    const usdAmount = input.currency === 'USD' ? amount : amount.div(rate).toDecimalPlaces(2);
    if (!usdAmount.gt(0)) throw new DomainError('El equivalente USD debe ser mayor a cero');
    const row = await tx.clientDeposit.create({ data: { storeId, clientId, requestKey: input.requestKey, amount, currency: input.currency, exchangeRate: rate, usdAmount, method: input.method,
      productId: product?.id, productLabel: product ? [product.model, product.capacity, product.imei].filter(Boolean).join(' · ').slice(0, 200) : null, previousInventoryStatus: product?.status } });
    if (product) await tx.inventoryItem.update({ where: { id: product.id }, data: { status: 'RESERVADO', reservedDepositId: row.id, reservedClientId: client.id, reservedClientName: client.name, reservedAt: row.createdAt } });
    await recordCash(tx, { storeId, amount: Number(row.amount), currency: row.currency, method: row.method, sourceType: 'deposit', sourceId: row.id, note: 'Cobro de seña', actor, requestKey: `deposit:${row.id}` });
    await movement(tx, row, 'SENA', 'Cobro de seña');
    await audit(tx, row, actor, 'created', `${amount} ${row.currency} · USD ${usdAmount} · cotización ${rate}${row.productLabel ? ` · reserva ${row.productLabel}` : ''}`);
    return serializeDeposit(row);
  });
}
async function release(tx: Prisma.TransactionClient, row: ClientDeposit) {
  if (!row.productId) return;
  await tx.inventoryItem.updateMany({ where: { id: row.productId, storeId: row.storeId, reservedDepositId: row.id }, data: { status: row.previousInventoryStatus ?? 'DISPONIBLE', ...clearReservation } });
}
export async function cancelDeposit(storeId: string, clientId: string, id: string, mode: 'REFUND' | 'CREDIT', actor?: Actor) {
  return withSerializableRetry(async (tx) => {
    const row = await tx.clientDeposit.findFirst({ where: { id, storeId, clientId } });
    if (!row) throw new DomainError('Seña no encontrada', 404);
    if (row.status === 'REFUNDED' || row.status === 'CREDIT' && mode === 'CREDIT') return serializeDeposit(row);
    if (!available.includes(row.status)) throw new DomainError('La seña ya fue aplicada; cancelá la venta asociada', 409);
    if (mode === 'REFUND') await recordCash(tx, { storeId, amount: -Number(row.amount), currency: row.currency, method: row.method, sourceType: 'deposit', sourceId: row.id, note: 'Devolución de seña', actor, requestKey: `deposit-refund:${row.id}` });
    await release(tx, row);
    const saved = await tx.clientDeposit.update({ where: { id }, data: { status: mode === 'REFUND' ? 'REFUNDED' : 'CREDIT', cancelledAt: new Date() } });
    await movement(tx, row, mode === 'REFUND' ? 'DEVOLUCION' : 'CREDITO', mode === 'REFUND' ? 'Devolución de seña' : 'Seña convertida en saldo a favor (sin nuevo cobro)');
    await audit(tx, row, actor, mode === 'REFUND' ? 'refunded' : 'credited', `${row.amount} ${row.currency} · equipo liberado`);
    return serializeDeposit(saved);
  });
}
/** Consumes whole receipts; fails atomically on wrong client, reuse, reservation mismatch or excess. */
export async function applyDeposits(tx: Prisma.TransactionClient, input: { storeId: string; clientId: string | null; ids?: string[]; currency: string; rate?: number | null; maximum: number; productId?: string | null; saleId?: string; repairId?: string; actor?: Actor }) {
  const ids = input.ids ?? [];
  if (!ids.length) return new Decimal(0);
  if (!input.clientId || new Set(ids).size !== ids.length) throw new DomainError('Elegí señas del mismo cliente, sin duplicados');
  const rows = await tx.clientDeposit.findMany({ where: { id: { in: ids }, storeId: input.storeId, clientId: input.clientId, status: { in: available } } });
  if (rows.length !== ids.length) throw new DomainError('Alguna seña ya fue aplicada o no pertenece al cliente', 409);
  for (const row of rows) if (row.status === 'ACTIVE' && row.productId && row.productId !== input.productId) throw new DomainError('La seña reserva otro equipo. Cancelá la reserva y dejala como saldo a favor primero', 409);
  const total = rows.reduce((sum, row) => sum.add(depositValue(row, input.currency, input.rate)), new Decimal(0));
  if (!total.gt(0) || total.gt(new Decimal(input.maximum))) throw new DomainError('Las señas superan el importe que falta pagar');
  for (const row of rows) {
    const value = depositValue(row, input.currency, input.rate);
    await tx.clientDeposit.update({ where: { id: row.id }, data: { status: 'APPLIED', saleId: input.saleId ?? null, repairId: input.repairId ?? null, appliedAmount: value, appliedCurrency: input.currency, appliedAt: new Date() } });
    // Consumed stock is sold by the enclosing sale; no longer a reservation.
    await tx.inventoryItem.updateMany({ where: { storeId: input.storeId, reservedDepositId: row.id }, data: clearReservation });
    await movement(tx, row, 'APLICACION', `Seña aplicada a ${input.saleId ? 'venta' : 'reparación'} (sin nuevo cobro)`, value, input.currency);
    await audit(tx, row, input.actor, 'applied', `${value} ${input.currency} · ${input.saleId ?? input.repairId}`);
  }
  return total;
}
export async function restoreSaleDeposits(tx: Prisma.TransactionClient, storeId: string, saleId: string, actor?: Actor | null) {
  const rows = await tx.clientDeposit.findMany({ where: { storeId, saleId, status: 'APPLIED' } });
  for (const row of rows) {
    await tx.clientDeposit.update({ where: { id: row.id }, data: { status: 'CREDIT', cancelledAt: new Date() } });
    await movement(tx, row, 'CREDITO', 'Seña disponible por cancelación de venta (sin devolución)');
    await audit(tx, row, actor ?? undefined, 'restored', `Venta ${saleId} cancelada · saldo a favor ${row.amount} ${row.currency}`);
  }
}
export async function restoreRepairDeposits(tx: Prisma.TransactionClient, storeId: string, repairId: string, actor?: Actor | null) {
  const rows = await tx.clientDeposit.findMany({ where: { storeId, repairId, status: 'APPLIED' } });
  for (const row of rows) {
    await tx.clientDeposit.update({ where: { id: row.id }, data: { status: 'CREDIT', repairId: null, cancelledAt: new Date() } });
    await movement(tx, row, 'CREDITO', 'Saldo a favor por eliminación de la orden (sin devolución)');
    await audit(tx, row, actor ?? undefined, 'restored', `Orden ${repairId} eliminada · saldo a favor ${row.amount} ${row.currency}`);
  }
}
export async function applyDepositToRepair(storeId: string, clientId: string, id: string, repairId: string, exchangeRate: number | undefined, actor: Actor) {
  return withSerializableRetry(async (tx) => {
    const repair = await tx.repairOrder.findFirst({ where: { id: repairId, storeId, clientId } });
    if (!repair) throw new DomainError('Orden del cliente no encontrada', 404);
    const prior = await tx.clientDeposit.findFirst({ where: { id, storeId, clientId } });
    if (prior?.status === 'APPLIED' && prior.repairId === repairId) return { deposit: serializeDeposit(prior), repairDeposit: Number(repair.deposit), repairCurrency: repair.currency };
    if (repair.estimate == null) throw new DomainError('Completá el presupuesto de la reparación antes de aplicar una seña');
    if (repair.status === 'ENTREGADO' || repair.status === 'ENTREGADA' || repair.status === 'CANCELADO') throw new DomainError('La reparación ya está cerrada', 409);
    const currency = repair.currency ?? await storeCurrency(storeId, tx);
    const amount = await applyDeposits(tx, { storeId, clientId, ids: [id], currency, rate: exchangeRate, maximum: Number(repair.estimate.sub(repair.deposit)), repairId, actor });
    await tx.repairOrder.update({ where: { id: repairId }, data: { deposit: repair.deposit.add(amount), currency } });
    await tx.repairStatusEvent.create({ data: { storeId, orderId: repairId, status: repair.status } });
    return { deposit: serializeDeposit((await tx.clientDeposit.findFirst({ where: { id, storeId, clientId } }))!), repairDeposit: Number(repair.deposit.add(amount)), repairCurrency: currency };
  });
}
