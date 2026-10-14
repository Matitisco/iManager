import type { CommissionRule, CommissionTotals } from '../types/commissions';
export const EMPTY_TOTALS: CommissionTotals = { ARS: 0, USD: 0 };
export const commissionAmount = (amount: number, currency: 'ARS' | 'USD') => `${amount < 0 ? '−' : ''}${currency === 'USD' ? 'US$' : '$'} ${Math.abs(amount).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
export const commissionTotal = (totals: CommissionTotals) => [totals.ARS !== 0 || totals.USD === 0 ? commissionAmount(totals.ARS, 'ARS') : '', totals.USD !== 0 ? commissionAmount(totals.USD, 'USD') : ''].filter(Boolean).join(' + ');
export const hasDeduction = (totals: CommissionTotals) => totals.ARS < 0 || totals.USD < 0;
export function monthKey(date = new Date(), timezone = 'America/Argentina/Buenos_Aires') {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}
export function monthLabel(period: string, offset = 0) {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 15)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function ruleLabel(rule?: Pick<CommissionRule, 'basis' | 'rate' | 'currency'> | null) {
  if (!rule) return 'Sin regla vigente';
  return rule.basis === 'FIXED_PER_UNIT' ? `${commissionAmount(rule.rate, rule.currency ?? 'ARS')} por equipo` : `${rule.rate} % sobre ${rule.basis === 'PROFIT_PERCENT' ? 'ganancia' : 'venta'}`;
}
export function effectiveRule(rules: CommissionRule[], memberId: string | null, period: string, timezone = 'America/Argentina/Buenos_Aires') {
  const eligible = rules.filter(rule => rule.active !== false && monthKey(new Date(rule.effectiveFrom), timezone) <= period).sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime() || b.createdAt.localeCompare(a.createdAt));
  return eligible.find(rule => rule.memberId === memberId) ?? eligible.find(rule => rule.memberId === null);
}

export const saleCount = (count: number) => `${count} ${count === 1 ? "venta" : "ventas"}`;
