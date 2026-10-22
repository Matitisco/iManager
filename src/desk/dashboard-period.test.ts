import { describe, expect, it } from 'vitest';
import { dashboardDay, dashboardMonth, dashboardTrend, shiftDashboardMonth } from './dashboard-period';
const point = (start: string, revenue: number) => ({ start, revenue, unitsSold: 1, label: '' });
describe('períodos Dashboard', () => {
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
});
