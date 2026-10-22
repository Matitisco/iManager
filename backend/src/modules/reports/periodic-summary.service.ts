import type { Prisma } from '@prisma/client';
import { prisma } from '../../plugins/prisma.js';
import { parseArDate } from '../../lib/ar-date.js';
import { DomainError } from '../../lib/domain-error.js';
import { canAccessSection } from '../stores/sections.js';
import { canManageStockCount } from '../stock-counts/access.js';
import { SUMMARY_ZONE, summaryDay, summaryPeriod, summaryPeriods } from './summary-period.js';

type Member = { role: string; sections?: unknown };
export type SummaryAmount = { amount: number; currency: string | null };
export function summaryAmounts(rows: SummaryAmount[]) {
  const grouped = new Map<string | null, number>();
  for (const row of rows) grouped.set(row.currency, (grouped.get(row.currency) ?? 0) + row.amount);
  return [...grouped].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}

export function summarySaleVoided(sale: { status: string; voidedAt: Date | null; cancelledAt: Date | null }) {
  return sale.status === 'CANCELADA' || sale.status === 'ANULADA' || sale.voidedAt != null || sale.cancelledAt != null;
}

export function stockSummaryLines(result: Prisma.JsonValue) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new DomainError('No se pudo leer el resultado del conteo', 500);
  const rows: Array<{ imei: string; title: string; status: 'Falta' | 'Sobra' | 'Figura vendido' }> = [];
  for (const [bucket, status] of [['missing', 'Falta'], ['surplus', 'Sobra'], ['sold', 'Figura vendido']] as const) {
    const lines = result[bucket];
    if (!Array.isArray(lines)) throw new DomainError('No se pudo leer el resultado del conteo', 500);
    for (const line of lines) {
      if (!line || typeof line !== 'object' || Array.isArray(line) || typeof line.imei !== 'string' || !line.imei) throw new DomainError('No se pudo leer el resultado del conteo', 500);
      if (bucket === 'sold' && line.note === 'Se vendió durante el conteo') continue;
      rows.push({ imei: line.imei, title: [line.model, line.capacity].filter(value => typeof value === 'string' && value).join(' ') || 'Equipo sin cargar', status });
    }
  }
  return rows;
}

export async function getPeriodicSummary(storeId: string, member: Member, selection = 'latest-half', now = new Date()) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  const timeZone = store.timezone || SUMMARY_ZONE;
  const { today, months, halves } = summaryPeriods(now, timeZone);
  const period = selection === 'latest-half' ? halves[0] : selection === 'latest-month' ? months[0] : summaryPeriod(selection);
  if (period.to >= today) throw new DomainError('Elegí un período cerrado', 400);
  const inPeriod = (day: string) => day >= period.from && day <= period.to;
  const salesAllowed = canAccessSection('sales', member);
  const stockAllowed = canManageStockCount(member);
  // A UTC envelope includes every local calendar day; the exact store-day filter is applied below.
  const envelope = { gte: new Date(`${period.from}T00:00:00Z`).getTime() - 86_400_000, lt: new Date(`${period.to}T00:00:00Z`).getTime() + 2 * 86_400_000 };
  const dateEnvelope = { gte: new Date(envelope.gte), lt: new Date(envelope.lt) };
  const [saleRecords, claims, counts] = await Promise.all([
    salesAllowed ? prisma.sale.findMany({
      where: { storeId },
      select: { id: true, dateLabel: true, soldAt: true, amount: true, amountCurrency: true, status: true, voidedAt: true, cancelledAt: true, deviceLabel: true, clientName: true, client: { select: { name: true } }, inventoryItem: { select: { model: true, capacity: true } } },
      orderBy: [{ soldAt: 'desc' }, { id: 'desc' }],
    }) : [],
    salesAllowed ? prisma.returnCase.findMany({
      where: { storeId, deletedAt: null, status: { not: 'ANULADO' } },
      select: { id: true, openedAt: true, resolvedAt: true, deviceLabel: true, clientName: true, imei: true, moneyAmount: true, moneyCurrency: true, settlement: true, resolution: true, rmaStatus: true, status: true,
        events: { where: { storeId, status: { in: ['EN_PROVEEDOR', 'RESUELTO'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1, select: { createdAt: true } },
      },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    }) : [],
    stockAllowed ? prisma.stockCount.findMany({
      where: { storeId, status: 'CLOSED', closedAt: dateEnvelope },
      select: { id: true, closedAt: true, result: true },
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
    }) : [],
  ]);
  const sales = saleRecords.flatMap(sale => {
    const storedDay = parseArDate(sale.dateLabel);
    const day = storedDay && !sale.dateLabel.includes('T')
      ? `${storedDay.getFullYear()}-${String(storedDay.getMonth() + 1).padStart(2, '0')}-${String(storedDay.getDate()).padStart(2, '0')}`
      : summaryDay(sale.soldAt, timeZone);
    if (!inPeriod(day)) return [];
    return [{ id: sale.id, day, title: sale.deviceLabel || [sale.inventoryItem?.model, sale.inventoryItem?.capacity].filter(Boolean).join(' ') || 'Venta', detail: sale.clientName || sale.client?.name || '', amount: Number(sale.amount), currency: sale.amountCurrency, voided: summarySaleVoided(sale) }];
  }).sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id));
  const returns = claims.flatMap(claim => {
    // Supplier RMA may settle a refund before the repair is completed.
    const day = summaryDay(claim.events[0]?.createdAt ?? claim.resolvedAt ?? claim.openedAt, timeZone);
    if (!inPeriod(day)) return [];
    const settled = claim.settlement === 'REINTEGRO' || claim.settlement === 'NOTA_CREDITO';
    const kind = claim.rmaStatus ? 'RMA' : claim.settlement === 'NOTA_CREDITO' ? 'nota de crédito' : claim.settlement === 'REINTEGRO' ? 'reintegro' : 'reclamo';
    return [{ id: claim.id, day, title: `${claim.deviceLabel || 'Equipo'} · ${kind}`, detail: claim.clientName || (claim.imei ? `IMEI ${claim.imei}` : ''), amount: settled ? Number(claim.moneyAmount) : 0, currency: claim.moneyCurrency, pending: claim.status !== 'RESUELTO' && claim.status !== 'CERRADO', status: claim.rmaStatus || claim.status }];
  }).sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id));
  const closed = counts.filter(count => count.closedAt && inPeriod(summaryDay(count.closedAt, timeZone)));
  const differences = new Map<string, { id: string; day: string; title: string; imei: string; status: 'Falta' | 'Sobra' | 'Figura vendido' }>();
  for (const count of closed) for (const line of stockSummaryLines(count.result)) {
    if (!differences.has(line.imei)) differences.set(line.imei, { ...line, id: `${count.id}:${line.imei}`, day: summaryDay(count.closedAt!, timeZone) });
  }
  return {
    period, periods: { months, halves },
    sales: salesAllowed ? { total: summaryAmounts(sales.filter(sale => !sale.voided)), items: sales } : null,
    returns: salesAllowed ? { total: summaryAmounts(returns.filter(claim => claim.amount !== 0)), items: returns } : null,
    stock: stockAllowed ? { count: differences.size, counts: closed.length, latestDay: closed[0]?.closedAt ? summaryDay(closed[0].closedAt, timeZone) : null, items: [...differences.values()] } : null,
  };
}
