import { parseAppDate, parseMoney } from './format';

export function includesText(value: string, query: string) {
  const needle = query.trim().toLowerCase();
  return !needle || value.toLowerCase().includes(needle);
}

export function matchesDateRange(value: string | null | undefined, from: string, to: string) {
  const start = bound(from);
  const end = bound(to);
  if (start == null && end == null) return true;
  const at = parseAppDate(value)?.getTime();
  if (at == null) return false;
  if (start != null && at < start) return false;
  if (end != null && at > end) return false;
  return true;
}

export function matchesMoney(amount: number, min: string, max: string) {
  if (min.trim() && amount < parseMoney(min)) return false;
  if (max.trim() && amount > parseMoney(max)) return false;
  return true;
}

function bound(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseAppDate(trimmed)?.getTime() ?? null;
}
