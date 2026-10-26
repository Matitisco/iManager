import { prisma } from '../../plugins/prisma.js';
import { getPeriodicSummary } from '../reports/periodic-summary.service.js';
import { getNetProfit } from '../reports/net-profit.service.js';
import { combineAmounts } from './report-math.js';
import { addCalendarDays, calendarDay, labelToIso, periodLabel, type DuePeriod } from './schedule.js';

export async function loadMailReport(storeId: string, period: DuePeriod, now: Date) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
  const selection = period.frequency === 'WEEKLY' ? `week:${period.start}` : period.frequency === 'MONTHLY' ? `month:${period.start.slice(0, 7)}` : `half:${period.start}`;
  const [summary, profit, stock, trades, clients] = await Promise.all([
    getPeriodicSummary(storeId, { role: 'OWNER' }, selection, now),
    getNetProfit(storeId, period.start, addCalendarDays(period.end, -1)),
    prisma.inventoryItem.count({ where: { storeId, archivedAt: null, status: 'DISPONIBLE' } }),
    prisma.tradeIn.findMany({ where: { storeId, confirmationStatus: 'CONFIRMED', voidedAt: null, cancelledAt: null, status: { notIn: ['CANCELADO', 'ANULADO', 'CANCELADA', 'ANULADA'] } }, select: { dateLabel: true, tradeAt: true } }),
    prisma.client.findMany({ where: { storeId, archivedAt: null, pendingBalance: { gt: 0 } }, select: { pendingBalance: true, balanceCurrency: true } }),
  ]);
  const inPeriod = (day: string) => day >= period.start && day < period.end;
  const currency = profit.currency;
  const sum = (rows: { amount: number; currency: string | null }[]) => combineAmounts(rows, currency, profit.sellRate);
  const sales = summary.sales?.items.filter(s => !s.voided) ?? [];
  return {
    storeName: store.name, timezone: store.timezone, currency, period, periodLabel: periodLabel(period.start, period.end), capturedAt: now.toISOString(),
    sales: sum(sales), sold: sales.length, profit: profit.netProfit, stock,
    trades: trades.filter(t => inPeriod(labelToIso(t.dateLabel) ?? (/^\d{4}-\d{2}-\d{2}$/.test(t.dateLabel) ? t.dateLabel : calendarDay(t.tradeAt, store.timezone)))).length,
    claims: summary.returns?.items.length ?? 0, pendingClaims: summary.returns?.items.filter(r => r.pending).length ?? 0,
    refunds: sum(summary.returns?.total ?? []), debt: sum(clients.map(c => ({ amount: Number(c.pendingBalance), currency: c.balanceCurrency }))), debtors: clients.length,
    differences: summary.stock?.count ?? 0, counts: summary.stock?.counts ?? 0, countDay: summary.stock?.latestDay ?? null,
  };
}
export type MailReport = Awaited<ReturnType<typeof loadMailReport>>;
