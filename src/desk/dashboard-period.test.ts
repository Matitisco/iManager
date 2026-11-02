import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardDay, dashboardLast7Days, dashboardMonth, dashboardTrend, shiftDashboardMonth } from './dashboard-period';
const point = (start: string, revenue: number) => ({ start, revenue, unitsSold: 1, label: '' });
afterEach(() => vi.useRealTimers());
describe('períodos Dashboard', () => {
  it.each([
    ['2026-10-22', '2026-10-16'],
    ['2026-11-01', '2026-10-26'],
    ['2026-01-01', '2025-12-26'],
    ['2024-03-01', '2024-02-24'],
  ])('incluye hoy y los seis días anteriores al %s', (today, start) => {
    const range = dashboardLast7Days(today);
    expect(range).toEqual({ start, end: today });
    expect(dashboardTrend([], range).buckets).toHaveLength(7);
  });
  it('calcula por defecto hoy en Argentina a ambos lados de medianoche', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T02:59:59Z'));
    expect(dashboardLast7Days()).toEqual({ start: '2026-10-25', end: '2026-10-31' });
    vi.setSystemTime(new Date('2026-11-01T03:00:00Z'));
    expect(dashboardLast7Days()).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
  it('usa la fecha argentina cerca de medianoche UTC', () => {
    expect(dashboardDay(new Date('2026-10-23T02:59:59Z'))).toBe('2026-10-22');
    expect(dashboardDay(new Date('2026-10-23T03:00:00Z'))).toBe('2026-10-23');
  });
  it('recorta mes actual a hoy y navega meses cortos sin desbordar', () => {
    const range = dashboardMonth('2026-03', '2026-03-31');
    expect(shiftDashboardMonth(range, -1, '2026-03-31')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(dashboardMonth('2026-10', '2026-10-22')).toEqual({ start: '2026-10-01', end: '2026-10-22' });
    expect(dashboardMonth('2024-02', '2026-10-22').end).toBe('2024-02-29');
  });
  it('agrupa días cortos sin perder días vacíos', () => {
    const { unit, buckets } = dashboardTrend([point('2026-10-02', 20)], { start: '2026-10-01', end: '2026-10-03' });
    expect(unit).toBe('day'); expect(buckets.map(p => p.revenue)).toEqual([0, 20, 0]);
  });
  it('agrupa semanas con la última incompleta y preserva el total', () => {
    const { unit, buckets } = dashboardTrend([point('2026-10-01', 10), point('2026-10-08', 20), point('2026-10-22', 30)], { start: '2026-10-01', end: '2026-10-22' });
    expect(unit).toBe('week'); expect(buckets.map(p => p.revenue)).toEqual([10, 20, 0, 30]);
  });
  it('agrupa meses de rangos largos aunque empiecen a mitad de mes', () => {
    const { unit, buckets } = dashboardTrend([point('2026-01-01', 10), point('2026-02-01', 20), point('2026-04-01', 30)], { start: '2026-01-15', end: '2026-04-22' });
    expect(unit).toBe('month'); expect(buckets.map(p => p.revenue)).toEqual([10, 20, 0, 30]);
  });
  it('Total agrupa por mes preservando años, meses vacíos y el total', () => {
    const { unit, buckets } = dashboardTrend([point('2025-12-01', 10), point('2026-02-01', 20)], null);
    expect(unit).toBe('month');
    expect(buckets.map(p => p.revenue)).toEqual([10, 0, 20]);
    expect(buckets[0].label).toContain('25');
    expect(buckets.at(-1)?.label).toContain('26');
    expect(dashboardTrend([], null).buckets).toEqual([]);
  });
  it('limita a doce grupos el histórico largo sin perder importes', () => {
    const { buckets } = dashboardTrend([point('2020-01-01', 10), point('2026-10-01', 20)], null);
    expect(buckets.length).toBeLessThanOrEqual(12);
    expect(buckets.reduce((sum, bucket) => sum + bucket.revenue, 0)).toBe(30);
  });

});
