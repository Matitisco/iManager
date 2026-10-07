import { parseAppDate, type PeriodKey } from './format';

export type ReportPeriod = PeriodKey | 'Personalizado';
export interface ReportBounds {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}
export interface ReportBucket {
  label: string;
  start: Date;
  end: Date;
  value: number;
}

const DAY_MS = 86_400_000;
const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
const inputDate = (date: Date) => `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function defaultReportRange(now = new Date()) {
  return { startDate: inputDate(addDays(now, -29)), endDate: inputDate(now) };
}

function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function customReportBounds(startDate: string, endDate: string): { bounds: ReportBounds; error?: never } | { bounds?: never; error: string } {
  if (!startDate || !endDate) return { error: 'Seleccioná una fecha de inicio y una fecha de fin.' };
  const start = parseCalendarDate(startDate);
  const lastDay = parseCalendarDate(endDate);
  if (!start || !lastDay) return { error: 'El período contiene una fecha inválida.' };
  if (start > lastDay) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  const end = addDays(lastDay, 1);
  const days = calendarDay(end) - calendarDay(start);
  return { bounds: { start, end, prevStart: addDays(start, -days), prevEnd: new Date(start) } };
}

export function parseReportDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? parseCalendarDate(trimmed) : parseAppDate(trimmed);
}

export function inReportPeriod(value: string | undefined, start: Date, end: Date): boolean {
  const date = parseReportDate(value);
  return !!date && date >= start && date < end;
}

export function reportRangeLabel(bounds: ReportBounds): string {
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
  return `${bounds.start.toLocaleDateString('es-AR', options)} al ${addDays(bounds.end, -1).toLocaleDateString('es-AR', options)}`;
}

export function formatReportDate(value: string): string {
  return parseReportDate(value)?.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) ?? '—';
}

function addMonths(date: Date, months: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

export function makeReportBuckets(period: ReportPeriod, bounds: ReportBounds) {
  const days = calendarDay(bounds.end) - calendarDay(bounds.start);
  const unit = period === 'Semana' || (period === 'Personalizado' && days <= 12) ? 'day'
    : period === 'Mes' || (period === 'Personalizado' && days <= 84) ? 'week' : 'month';
  const months = (bounds.end.getFullYear() - bounds.start.getFullYear()) * 12
    + bounds.end.getMonth() - bounds.start.getMonth() + (bounds.end.getDate() > bounds.start.getDate() ? 1 : 0);
  const step = unit === 'month' ? Math.max(1, Math.ceil(months / 12)) : unit === 'week' ? 7 : 1;
  const bucketLabel = unit === 'day' ? 'por día' : unit === 'week' ? 'por semana' : step === 1 ? 'por mes' : `cada ${step} meses`;
  const buckets: ReportBucket[] = [];
  let start = new Date(bounds.start);
  while (start < bounds.end) {
    const next = unit === 'month' ? addMonths(bounds.start, (buckets.length + 1) * step) : addDays(start, step);
    const end = new Date(Math.min(next.getTime(), bounds.end.getTime()));
    const label = unit === 'month'
      ? start.toLocaleDateString('es-AR', { month: 'short', ...(bounds.start.getFullYear() !== bounds.end.getFullYear() ? { year: '2-digit' } : {}) }).replace('.', '')
      : start.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });
    buckets.push({ label, start, end, value: 0 });
    start = end;
  }
  return { buckets, bucketLabel };
}

export function addToReportBucket(buckets: ReportBucket[], date: string | undefined, amount: number) {
  const value = parseReportDate(date);
  if (!value) return;
  const bucket = buckets.find((item) => value >= item.start && value < item.end);
  if (bucket) bucket.value += amount;
}
