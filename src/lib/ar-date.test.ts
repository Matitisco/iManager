import { describe, expect, it } from 'vitest';
import { formatArDate, formatArDateTime, formatStoredDate, parseArDate } from './ar-date';

describe('Argentine dates', () => {
  it('formats a calendar day as DD/MM/YYYY', () => {
    expect(formatArDate(new Date(2026, 9, 7, 12))).toBe('07/10/2026');
  });

  it('reads slash dates as day/month/year', () => {
    expect(parseArDate('07/10/2026')).toEqual(new Date(2026, 9, 7, 12));
    expect(parseArDate('7/10/2026')).toEqual(new Date(2026, 9, 7, 12));
    expect(formatArDate(parseArDate('7/10/2026')!)).toBe('07/10/2026');
  });

  it('keeps a date-only ISO value on that calendar day', () => {
    expect(formatArDate(parseArDate('2026-04-02')!)).toBe('02/04/2026');
  });

  it('reads legacy Spanish labels, including the ICU "de" form', () => {
    expect(formatStoredDate('07 de oct de 2026', new Date(2020, 0, 1))).toBe('07/10/2026');
    expect(formatStoredDate('7 oct. 2026', new Date(2020, 0, 1))).toBe('07/10/2026');
    expect(formatStoredDate('7 de octubre de 2026', new Date(2020, 0, 1))).toBe('07/10/2026');
  });

  it('formats an instant as day/month/year and 24-hour time in Argentina', () => {
    expect(formatArDateTime('2026-10-09T15:04:00.000Z')).toBe('09/10/2026 12:04');
  });

  it('rejects impossible days and falls back to the stored instant', () => {
    expect(parseArDate('31/02/2026')).toBeNull();
    expect(parseArDate('N/A')).toBeNull();
    expect(formatStoredDate('no es una fecha', new Date(2026, 3, 8, 12))).toBe('08/04/2026');
  });
});
