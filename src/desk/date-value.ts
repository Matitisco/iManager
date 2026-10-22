import { parseArDate } from '../lib/ar-date';

/** A calendar day, without interpreting it as a UTC timestamp. */
export function isDateValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseArDate(value) !== null;
}
