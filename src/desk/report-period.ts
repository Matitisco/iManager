import { formatArDate, parseAppDate } from './format';

export const REPORT_PRESETS = ['7 días', '30 días', '90 días', '12 meses', 'Este mes'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export type ReportPeriod = ReportPreset | 'Personalizado';
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

export function reportRangeLabel(bounds: Pick<ReportBounds, 'start' | 'end'>): string {
  return `${formatArDate(bounds.start)} al ${formatArDate(addDays(bounds.end, -1))}`;
}

export function reportBucketRange(bucket: { label: string; start?: Date; end?: Date }) {
  return bucket.start && bucket.end ? reportRangeLabel({ start: bucket.start, end: bucket.end }) : bucket.label;
}

export function formatReportDate(value: string): string {
  const date = parseReportDate(value);
  return date ? formatArDate(date) : '—';
}

function addMonths(date: Date, months: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

export function reportDayCount(bounds: ReportBounds) {
  return calendarDay(bounds.end) - calendarDay(bounds.start);
}

export function reportPresetBounds(preset: ReportPreset, now = new Date()): ReportBounds {
  const end = addDays(now, 1);
  const start = preset === 'Este mes' ? new Date(now.getFullYear(), now.getMonth(), 1)
    : preset === '12 meses' ? new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
    : addDays(end, -(preset === '7 días' ? 7 : preset === '90 días' ? 90 : 30));
  return { start, end, prevStart: addDays(start, -(calendarDay(end) - calendarDay(start))), prevEnd: new Date(start) };
}

export function reportComparisonLabel(bounds: ReportBounds) {
  return `${formatArDate(bounds.prevStart)} al ${formatArDate(addDays(bounds.prevEnd, -1))}`;
}

export function reportPeriodLabel(period: ReportPeriod) {
  return period === 'Personalizado' || period === 'Este mes' ? period
    : period === '12 meses' ? 'Últimos 12 meses' : `Últimos ${period}`;
}

export function makeReportBuckets(_period: ReportPeriod, bounds: ReportBounds) {
  const days = reportDayCount(bounds);
  const monthly = days > 120;
  const months = (bounds.end.getFullYear() - bounds.start.getFullYear()) * 12
    + bounds.end.getMonth() - bounds.start.getMonth() + (bounds.end.getDate() > bounds.start.getDate() ? 1 : 0);
  const step = monthly ? Math.max(1, Math.ceil(months / 12)) : days <= 12 ? 1 : days <= 36 ? 3 : Math.ceil(days / 12);
  const bucketLabel = monthly ? step === 1 ? 'Por mes' : `Cada ${step} meses` : step === 1 ? 'Por día' : `Cada ${step} días`;
  const buckets: ReportBucket[] = [];
  let start = new Date(bounds.start);
  while (start < bounds.end) {
    const next = monthly ? addMonths(bounds.start, (buckets.length + 1) * step) : addDays(start, step);
    const end = new Date(Math.min(next.getTime(), bounds.end.getTime()));
    buckets.push({ label: formatArDate(start), start, end, value: 0 });
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
