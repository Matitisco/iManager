export const REPORT_TIME_ZONE = "America/Argentina/Buenos_Aires";
export const SEND_HOUR = 8;
export const FREQUENCIES = ["BIWEEKLY", "MONTHLY"] as const;
export type ReportFrequency = (typeof FREQUENCIES)[number];

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

export interface DuePeriod {
  key: string;
  frequency: ReportFrequency;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
}

export function zonedParts(now: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  let hour = read("hour");
  if (hour === 24) hour = 0;
  return { year: read("year"), month: read("month"), day: read("day"), hour };
}

export function isoDay(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function addCalendarDays(value: string, days: number) {
  const parsed = parseIsoDay(value);
  if (!parsed) throw new Error("Fecha inválida");
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return isoDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function daysBetween(start: string, end: string) {
  const left = parseIsoDay(start);
  const right = parseIsoDay(end);
  if (!left || !right) throw new Error("Fecha inválida");
  return Math.round((Date.UTC(right.year, right.month - 1, right.day) - Date.UTC(left.year, left.month - 1, left.day)) / 86_400_000);
}

export function calendarDay(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  return isoDay(parts.year, parts.month, parts.day);
}

export function labelToIso(label: string | null | undefined) {
  const match = label?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return parseIsoDay(isoDay(Number(match[3]), Number(match[2]), Number(match[1])))
    ? isoDay(Number(match[3]), Number(match[2]), Number(match[1]))
    : null;
}

export function formatDay(value: string) {
  const parsed = parseIsoDay(value);
  if (!parsed) return value;
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${parsed.year}`;
}

export function periodLabel(start: string, end: string) {
  return `${formatDay(start)} al ${formatDay(addCalendarDays(end, -1))}`;
}

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function reached(parts: ZonedParts, day: number) {
  return parts.day > day || (parts.day === day && parts.hour >= SEND_HOUR);
}

function buildPeriod(frequency: ReportFrequency, start: string, end: string): DuePeriod {
  const days = daysBetween(start, end);
  return {
    key: `${frequency}:${start}:${end}`,
    frequency,
    start,
    end,
    previousStart: addCalendarDays(start, -days),
    previousEnd: start,
  };
}

/** Latest closed window whose 08:00 send time, in the store timezone, is already past. */
export function latestDuePeriod(now: Date, timeZone: string, frequency: ReportFrequency): DuePeriod {
  const parts = zonedParts(now, timeZone);
  if (frequency === "MONTHLY") {
    const once = previousMonth(parts.year, parts.month);
    const closed = reached(parts, 1) ? once : previousMonth(once.year, once.month);
    const start = isoDay(closed.year, closed.month, 1);
    const end = closed.month === 12 ? isoDay(closed.year + 1, 1, 1) : isoDay(closed.year, closed.month + 1, 1);
    return buildPeriod("MONTHLY", start, end);
  }
  if (reached(parts, 16)) {
    return buildPeriod("BIWEEKLY", isoDay(parts.year, parts.month, 1), isoDay(parts.year, parts.month, 16));
  }
  if (reached(parts, 1)) {
    const prev = previousMonth(parts.year, parts.month);
    return buildPeriod("BIWEEKLY", isoDay(prev.year, prev.month, 16), isoDay(parts.year, parts.month, 1));
  }
  const prev = previousMonth(parts.year, parts.month);
  return buildPeriod("BIWEEKLY", isoDay(prev.year, prev.month, 1), isoDay(prev.year, prev.month, 16));
}

export function asFrequency(value: string | null | undefined): ReportFrequency {
  return value === "BIWEEKLY" ? "BIWEEKLY" : "MONTHLY";
}
