const MONTHS: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  set: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

function calendarDate(year: number, monthIndex: number, day: number, hours = 12): Date | null {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, monthIndex, day, hours, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null;
  return date;
}

export function formatArDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

export function parseArDate(value: string | null | undefined): Date | null {
  if (!value || value === 'N/A' || value === '—') return null;
  const trimmed = value.trim();
  const isoDay = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDay) return calendarDate(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const numeric = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numeric) return calendarDate(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));

  const named = trimmed
    .toLowerCase()
    .replace(/\./g, '')
    .match(/^(\d{1,2})(?:\s+de)?\s+([a-záéíóúñ]+)(?:\s+de)?\s+(\d{4})$/i);
  if (!named) return null;
  const key = named[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3);
  const month = MONTHS[key];
  if (month == null) return null;
  return calendarDate(Number(named[3]), month, Number(named[1]));
}

export function formatStoredDate(label: string | null | undefined, fallback: Date): string {
  return formatArDate(parseArDate(label) ?? fallback);
}
