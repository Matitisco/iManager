import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Domains remain separate: e.g. APROBADO in a trade is not a collected sale.
export const ACCOUNTING_STATES = {
  sale: ['COMPLETADA', 'PENDIENTE', 'CANCELADA', 'ANULADA'],
  trade: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'EN REVISIÓN', 'PERITAJE TÉC.', 'LISTO', 'CANCELADO', 'ANULADO'],
  deposit: ['ACTIVE', 'CREDIT', 'APPLIED', 'REFUNDED', 'REVERSED'],
  paymentKind: ['PAGO', 'DEVOLUCION', 'VUELTO', 'CARGO', 'NOTA_CREDITO', 'SENA', 'CREDITO', 'APLICACION'],
  tenderRole: ['COBRO', 'VUELTO'],
  commissionVoid: ['CANCELLED', 'DELETED', 'EDITED'],
  return: ['ABIERTO', 'EN_DIAGNOSTICO', 'EN_PROVEEDOR', 'RESUELTO', 'ANULADO'],
  returnEvent: ['ABIERTO', 'EN_DIAGNOSTICO', 'EN_PROVEEDOR', 'RESUELTO', 'ANULADO', 'ENVIADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'RECIBIDO'],
  rma: ['ENVIADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'RECIBIDO'],
  credit: ['ABIERTA', 'APLICADA'],
  cashSession: ['OPEN', 'SUBMITTED', 'APPROVED', 'RECOUNT'],
  cashKind: ['FONDO', 'INGRESO', 'EGRESO', 'AJUSTE', 'TRANSFERENCIA', 'COBRO', 'DEVOLUCION', 'ANULACION', 'ARQUEO'],
} as const;
export type AccountingDomain = keyof typeof ACCOUNTING_STATES;
export const stateToken = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[\s_]+/g, '_');
const ALIASES: Partial<Record<AccountingDomain, Record<string, string>>> = {
  sale: { COMPLETED: 'COMPLETADA', PENDING: 'PENDIENTE', CANCELLED: 'CANCELADA', CANCELED: 'CANCELADA', CANCELADO: 'CANCELADA', ANULADO: 'ANULADA' },
  trade: { PENDING: 'PENDIENTE', APPROVED: 'APROBADO', REJECTED: 'RECHAZADO', COMPLETADO: 'LISTO', COMPLETADA: 'LISTO', COMPLETED: 'LISTO', CANCELLED: 'CANCELADO', CANCELED: 'CANCELADO', CANCELADA: 'CANCELADO', ANULADA: 'ANULADO' },
};

/** Unknown/custom statuses survive unchanged. Never infer that an unknown sale is paid. */
export function normalizeAccountingState(domain: AccountingDomain, value: string): string {
  const token = stateToken(value);
  return ACCOUNTING_STATES[domain].find(state => stateToken(state) === token) ?? ALIASES[domain]?.[token] ?? value;
}
export const isSaleCancelled = (value: string | null | undefined) => value != null && ['CANCELADA', 'ANULADA'].includes(normalizeAccountingState('sale', value));
export const saleState = (value: string) => normalizeAccountingState('sale', value);
export const tradeState = (value: string) => normalizeAccountingState('trade', value);
export const saleStateSchema = z.string().transform(saleState).pipe(z.enum(['COMPLETADA', 'PENDIENTE', 'CANCELADA']));
export const tradeStateSchema = z.string().trim().min(1).max(30).transform(tradeState);

const TABLE_DOMAINS = {
  Sale: { status: 'sale' }, TradeIn: { status: 'trade', draftPaymentStatus: 'sale' },
  ClientDeposit: { status: 'deposit' }, ClientPayment: { kind: 'paymentKind' }, SaleTender: { role: 'tenderRole' },
  CommissionAccrual: { voidReason: 'commissionVoid' }, ReturnCase: { status: 'return', rmaStatus: 'rma' },
  ReturnEvent: { status: 'returnEvent' }, CreditNote: { status: 'credit' },
  CashSession: { status: 'cashSession' }, CashMovement: { kind: 'cashKind' },
} as const;
export type AccountingTable = keyof typeof TABLE_DOMAINS;

/** SQL equality alone misses mixed case, accents, spaces and historical aliases.
 * Resolve distinct stored spellings within this store; include canonical values for
 * concurrent writers. No backfill or table-wide data read, no interpolated user SQL. */
export async function storedStateFilter(
  tx: Prisma.TransactionClient, table: AccountingTable, storeId: string,
  states: readonly string[], exclude = false, field = 'status',
): Promise<{ in: string[] } | { notIn: string[] }> {
  const fields: Readonly<Record<string, AccountingDomain>> = TABLE_DOMAINS[table];
  const domain = fields[field];
  if (!domain) throw new Error('Unsupported accounting state field');
  const rows = await tx.$queryRaw<Array<{ value: string | null }>>(Prisma.sql`
    SELECT DISTINCT ${Prisma.raw('"' + field + '"')} AS value FROM ${Prisma.raw('"' + table + '"')}
    WHERE "storeId" = ${storeId}
  `);
  const wanted = new Set(states.map(state => normalizeAccountingState(domain, state)));
  if (domain === 'sale' && (wanted.has('CANCELADA') || wanted.has('ANULADA'))) { wanted.add('CANCELADA'); wanted.add('ANULADA'); }
  const values = [...new Set([...wanted, ...states, ...rows.flatMap(row => row.value != null && wanted.has(normalizeAccountingState(domain, row.value)) ? [row.value] : [])])];
  return exclude ? { notIn: values } : { in: values };
}

export const nullableAccountingState = (domain: AccountingDomain, value: string | null): string | null => value == null ? null : normalizeAccountingState(domain, value);
