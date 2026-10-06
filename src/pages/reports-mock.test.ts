import { describe, expect, it } from 'vitest';
import { foldDailySeriesByWeek } from '../utils/reports';
import { buildReportsMock } from './reports-mock';

describe('buildReportsMock', () => {
  it('fills the month with five weekly sales bars and a payment mix', () => {
    const report = buildReportsMock({ period: 'month' });
    const weeks = foldDailySeriesByWeek(report.salesSeries);

    expect(weeks.map((point) => point.revenue)).toEqual([1_350_000, 1_300_000, 400_000, 3_100_000, 2_300_000]);
    expect(report.summary.revenue).toBe(8_450_000);
    expect(report.summary.unitsSold).toBe(18);
    expect(report.paymentMethods.map((method) => method.label)).toEqual([
      'Transferencia',
      'Efectivo',
      'Tarjeta',
      'Canje / pago',
    ]);
    expect(report.topProducts).toHaveLength(4);
  });

  it('keeps stock and trade-ins complete enough to draw every bar', () => {
    const report = buildReportsMock({ period: 'month' });

    expect(report.inventory.aging.every((bucket) => bucket.count > 0 && bucket.costValue > 0)).toBe(true);
    expect(report.inventory.availableItems).toBe(28);
    expect(report.inventory.inReviewItems).toBeGreaterThan(0);
    expect(report.inventory.soldItems).toBeGreaterThan(0);
    expect(report.tradeIns.approvedInRange).toBeGreaterThan(0);
    expect(report.tradeIns.openInRange).toBeGreaterThan(0);
    expect(report.tradeIns.cashGenerated).toBeGreaterThan(0);
    expect(report.tradeIns.openCash).toBeGreaterThan(0);
    expect(report.tradeIns.otherCash).toBeGreaterThan(0);
  });

  it('builds a short week and a year without collapsing the series', () => {
    expect(buildReportsMock({ period: 'week' }).salesSeries).toHaveLength(7);
    expect(buildReportsMock({ period: 'year' }).salesSeries.length).toBeGreaterThan(0);
    expect(foldDailySeriesByWeek(buildReportsMock({ period: 'quarter' }).salesSeries).length).toBeGreaterThan(8);
  });
});