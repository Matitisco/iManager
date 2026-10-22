import { DomainError } from '../../lib/domain-error.js';

export const SUMMARY_ZONE = 'America/Argentina/Buenos_Aires';
export type SummaryPeriod = { id: string; kind: 'month' | 'half'; from: string; to: string; label: string };
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function summaryDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)!.value).join('-');
}

export function summaryPeriod(id: string): SummaryPeriod {
  const match = /^(month|half):(\d{4})-(\d{2})(?:-(01|16))?$/.exec(id);
  if (!match || (match[1] === 'half') !== Boolean(match[4])) throw new DomainError('El período no es válido', 400);
  const [, kind, yearText, monthText, half] = match;
  const year = Number(yearText), month = Number(monthText);
  if (year < 1000 || month < 1 || month > 12) throw new DomainError('El período no es válido', 400);
  const from = `${yearText}-${monthText}-${half ?? '01'}`;
  const to = half === '01' ? `${yearText}-${monthText}-15` : iso(new Date(Date.UTC(year, month, 0)));
  const monthLabel = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${from}T12:00:00Z`));
  const label = kind === 'month' ? monthLabel : `${half === '16' ? '16' : '01'} al ${to.slice(-2)}/${monthText}/${yearText}`;
  return { id, kind: kind as SummaryPeriod['kind'], from, to, label };
}

export function summaryPeriods(now = new Date(), timeZone = SUMMARY_ZONE) {
  const today = summaryDay(now, timeZone);
  const [year, month, day] = today.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const months = Array.from({ length: 12 }, (_, index) => {
    const previous = new Date(Date.UTC(year, month - 2 - index, 1));
    return summaryPeriod(`month:${iso(previous).slice(0, 7)}`);
  });
  let halfStart = day > 15 ? first : new Date(Date.UTC(year, month - 2, 16));
  const halves: SummaryPeriod[] = [];
  for (let index = 0; index < 24; index++) {
    halves.push(summaryPeriod(`half:${iso(halfStart)}`));
    halfStart = halfStart.getUTCDate() === 16
      ? new Date(Date.UTC(halfStart.getUTCFullYear(), halfStart.getUTCMonth(), 1))
      : new Date(Date.UTC(halfStart.getUTCFullYear(), halfStart.getUTCMonth() - 1, 16));
  }
  return { today, months, halves };
}
