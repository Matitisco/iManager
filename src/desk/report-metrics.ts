import type { Product, RepairOrder, Sale } from '../types';
import { isInStock } from './format';
import { averageLeadDays, repairLeadDays } from './report-breakdown';
import { inReportPeriod, parseReportDate, type ReportBounds } from './report-period';

export interface ReportDelta {
  direction: 'up' | 'down' | 'equal' | 'unavailable';
  magnitude: number | null;
  unit: 'percent' | 'count';
  comparison: string;
  tone: 'positive' | 'negative' | 'neutral';
  text: string;
}
export function reportDelta(current: number | null, previous: number | null, comparison: string, unit: ReportDelta['unit'] = 'percent', unavailable = 'Variación no disponible: falta cotización o datos'): ReportDelta {
  const base = { magnitude: null, unit, comparison, tone: 'neutral' as const };
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return { ...base, direction: 'unavailable', text: unavailable };
  if (current === previous) return { ...base, magnitude: 0, direction: 'equal', text: `= Igual que ${comparison}` };
  if (previous === 0) return { ...base, direction: 'unavailable', text: `Sin base para comparar con ${comparison}: valor anterior igual a cero` };
  const difference = current - previous;
  const up = difference > 0;
  const magnitude = unit === 'count' ? Math.abs(difference) : Math.abs(difference / previous) * 100;
  const shown = unit === 'percent' ? `${magnitude < 1 ? '< 1' : Math.round(magnitude).toLocaleString('es-AR')} %` : magnitude.toLocaleString('es-AR');
  return { magnitude, unit, comparison, direction: up ? 'up' : 'down', tone: unit === 'count' ? 'neutral' : up ? 'positive' : 'negative', text: `${up ? '↑' : '↓'} ${shown} · ${up ? 'más' : 'menos'} que ${comparison}` };
}

export type ProjectMoney = (amount: number, currency?: string | null) => number | null;
export function reportSum(rows: Array<{ amount: number; currency?: string | null }>, project: ProjectMoney): number | null {
  let total = 0;
  for (const row of rows) {
    const value = project(row.amount, row.currency);
    if (value == null || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

export function stockSummary(inventory: Product[], sales: Sale[] | null, bounds: ReportBounds, project: ProjectMoney) {
  const entries = inventory.filter(item => inReportPeriod(item.createdAt, bounds.start, bounds.end));
  const previous = inventory.filter(item => inReportPeriod(item.createdAt, bounds.prevStart, bounds.prevEnd));
  const available = inventory.filter(item => isInStock(item.status));
  const sold = (sales ?? []).filter(sale => sale.status !== 'CANCELADA' && inReportPeriod(sale.date, bounds.start, bounds.end));
  const durations = sold.map(sale => {
    const item = inventory.find(item => item.id === sale.productId);
    const start = parseReportDate(item?.createdAt);
    const end = parseReportDate(sale.date);
    return start && end && end >= start ? (end.getTime() - start.getTime()) / 86_400_000 : null;
  });
  return { entries: entries.length, previous: previous.length, undated: inventory.filter(item => !parseReportDate(item.createdAt)).length,
    available: available.length, saleValue: reportSum(available.map(item => ({ amount: item.price, currency: item.currency })), project),
    averageDays: sales == null ? null : averageLeadDays(durations), measured: durations.filter(value => value != null).length, sold: sold.length };
}

export function serviceSummary(orders: RepairOrder[], bounds: ReportBounds, project: ProjectMoney) {
  const current = orders.filter(order => inReportPeriod(order.receivedAt, bounds.start, bounds.end));
  const previous = orders.filter(order => inReportPeriod(order.receivedAt, bounds.prevStart, bounds.prevEnd));
  const delivered = current.filter(order => order.status === 'ENTREGADO');
  const budget = (rows: RepairOrder[]) => reportSum(rows.filter(order => order.estimate != null).map(order => ({ amount: order.estimate!, currency: order.currency })), project);
  const durations = delivered.map(repairLeadDays);
  return { received: current.length, quoted: current.filter(order => order.estimate != null).length, unquoted: current.filter(order => order.estimate == null).length,
    budget: budget(current), previousBudget: budget(previous), delivered: delivered.length, deliveredBudget: budget(delivered),
    averageDays: averageLeadDays(durations), measured: durations.filter(value => value != null).length };
}

export const durationText = (days: number | null) => days == null ? 'No disponible' : `${days.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${days === 1 ? 'día' : 'días'}`;
