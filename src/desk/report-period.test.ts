import { describe, expect, it } from 'vitest';
import { periodBounds } from './format';
import { addToReportBucket, customReportBounds, defaultReportRange, inReportPeriod, makeReportBuckets, reportRangeLabel } from './report-period';

function range(start: string, end: string) {
  const result = customReportBounds(start, end);
  if (!result.bounds) throw new Error(result.error);
  return result.bounds;
}

describe('custom report dates', () => {
  it.each([
    ['', '2026-04-03'],
    ['2026-04-01', ''],
    ['2026-04-04', '2026-04-03'],
    ['2026-02-29', '2026-03-01'],
    ['2026-04-31', '2026-05-01'],
    ['not-a-date', '2026-04-03'],
  ])('rejects an invalid range %s to %s', (start, end) => {
    expect(customReportBounds(start, end)).toEqual({ error: expect.any(String) });
  });

  it('accepts leap days and an inclusive single day', () => {
    const bounds = range('2024-02-29', '2024-02-29');
    expect(bounds.start).toEqual(new Date(2024, 1, 29));
    expect(bounds.end).toEqual(new Date(2024, 2, 1));
    expect(bounds.prevStart).toEqual(new Date(2024, 1, 28));
    expect(bounds.prevEnd).toEqual(bounds.start);
    expect(reportRangeLabel(bounds)).toBe('29/02/2024 al 29/02/2024');
  });

  it('uses local date-only values and timestamp offsets at both boundaries', () => {
    const { start, end } = range('2026-04-01', '2026-04-03');
    for (const date of ['2026-04-01', '2026-04-01T00:00:00-03:00', '2026-04-03', '2026-04-04T02:59:59.999Z']) {
      expect(inReportPeriod(date, start, end), date).toBe(true);
    }
    for (const date of ['2026-03-31', '2026-04-01T02:59:59.999Z', '2026-04-04', '2026-04-04T03:00:00Z', '', '2026-02-30']) {
      expect(inReportPeriod(date, start, end), date).toBe(false);
    }
  });

  it('compares against the immediately preceding equal calendar window', () => {
    const bounds = range('2026-01-01', '2026-01-03');
    expect(bounds.prevStart).toEqual(new Date(2025, 11, 29));
    expect(bounds.prevEnd).toEqual(new Date(2026, 0, 1));
  });

  it('defaults to thirty local calendar days', () => {
    expect(defaultReportRange(new Date(2026, 0, 3, 23))).toEqual({ startDate: '2025-12-05', endDate: '2026-01-03' });
  });
});

describe('report evolution coverage', () => {
  it.each([
    ['2026-04-03', '2026-04-03'],
    ['2026-04-01', '2026-04-12'],
    ['2026-04-01', '2026-04-30'],
    ['2026-01-01', '2026-03-25'],
    ['2024-01-31', '2024-05-15'],
    ['2025-12-31', '2026-12-30'],
    ['2020-01-31', '2026-10-07'],
  ])('covers every day once from %s to %s with at most twelve bars', (start, end) => {
    const bounds = range(start, end);
    const { buckets } = makeReportBuckets('Personalizado', bounds);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.length).toBeLessThanOrEqual(12);
    expect(buckets[0].start).toEqual(bounds.start);
    expect(buckets.at(-1)?.end).toEqual(bounds.end);
    for (let index = 1; index < buckets.length; index += 1) expect(buckets[index].start).toEqual(buckets[index - 1].end);
    let days = 0;
    for (const day = new Date(bounds.start); day < bounds.end; day.setDate(day.getDate() + 1)) {
      expect(buckets.filter((bucket) => day >= bucket.start && day < bucket.end)).toHaveLength(1);
      addToReportBucket(buckets, day.toISOString(), 1);
      days += 1;
    }
    addToReportBucket(buckets, bounds.end.toISOString(), 1000);
    expect(buckets.reduce((total, bucket) => total + bucket.value, 0)).toBe(days);
  });

  it.each(['Semana', 'Mes', '3 meses', 'Año'] as const)('covers the entire %s preset including its first partial month', (period) => {
    const bounds = periodBounds(period, new Date(2026, 9, 6));
    const { buckets } = makeReportBuckets(period, bounds);
    addToReportBucket(buckets, bounds.start.toISOString(), 100);
    addToReportBucket(buckets, new Date(bounds.end.getTime() - 1).toISOString(), 200);
    expect(buckets.reduce((total, bucket) => total + bucket.value, 0)).toBe(300);
    expect(buckets.length).toBeLessThanOrEqual(12);
  });
});
