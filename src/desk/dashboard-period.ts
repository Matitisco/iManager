import type { OverviewSeriesPoint } from '../services/reports-api';

export interface DashboardRange { start: string; end: string }
export const dashboardDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
// UTC here represents calendar days, independently of the browser's timezone.
export const dayDate = (value: string) => new Date(`${value}T12:00:00Z`);
export const shiftDay = (value: string, days: number) => {
  const date = dayDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export function dashboardMonth(month = dashboardDay().slice(0, 7), today = dashboardDay()): DashboardRange {
  const date = dayDate(`${month}-01`);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end: last > today ? today : last };
}
export function shiftDashboardMonth(range: DashboardRange, amount: number, today = dashboardDay()) {
  const date = dayDate(range.start);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dashboardMonth(date.toISOString().slice(0, 7), today);
}
export const dashboardMonthLabel = (value: string) => {
  const label = dayDate(value).toLocaleDateString('es-AR', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  return (label.charAt(0).toUpperCase() + label.slice(1)).replace(' de ', ' ');
};
export const dashboardRangeLabel = (range: DashboardRange) => {
  const format = (value: string) => dayDate(value).toLocaleDateString('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).replace('.', '');
  return `${format(range.start)} – ${format(range.end)}`;
};

export function dashboardTrendUnit(range: DashboardRange) {
  const days = Math.round((dayDate(range.end).getTime() - dayDate(range.start).getTime()) / 86400000) + 1;
  return days <= 12 ? 'day' : days <= 84 ? 'week' : 'month';
}

export function dashboardTrend(series: OverviewSeriesPoint[], range: DashboardRange) {
  const unit = dashboardTrendUnit(range);
  const buckets: Array<{ start: string; end: string; label: string; revenue: number }> = [];
  const months = (dayDate(range.end).getUTCFullYear() - dayDate(range.start).getUTCFullYear()) * 12 + dayDate(range.end).getUTCMonth() - dayDate(range.start).getUTCMonth() + 1;
  const step = Math.max(1, Math.ceil(months / 12));
  let start = range.start;
  while (start <= range.end) {
    const date = dayDate(start);
    if (unit === 'month') { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + step); }
    const end = unit === 'month' ? date.toISOString().slice(0, 10) : shiftDay(start, unit === 'week' ? 7 : 1);
    const label = unit === 'week' ? `Sem. ${buckets.length + 1}` : dayDate(start).toLocaleDateString('es-AR', { timeZone: 'UTC', ...(unit === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'numeric' }) });
    buckets.push({ start, end, label, revenue: 0 });
    start = end;
  }
  for (const point of series) {
    const bucket = buckets.find(item => (unit === 'month' ? point.start.slice(0, 7) >= item.start.slice(0, 7) : point.start >= item.start) && point.start < item.end);
    if (bucket) bucket.revenue += point.revenue;
  }
  return { unit, buckets };
}
