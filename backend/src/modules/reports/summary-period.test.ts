import { describe, expect, it } from 'vitest';
import { summaryDay, summaryPeriod, summaryPeriods } from './summary-period.js';
import { stockSummaryLines, summaryAmounts, summarySaleVoided } from './periodic-summary.service.js';

describe('completed summary periods', () => {
  it.each([
    ['2026-10-16T03:00:00Z', 'half:2026-10-01', '2026-10-15', 'month:2026-09'],
    ['2026-10-16T02:59:59Z', 'half:2026-09-16', '2026-09-30', 'month:2026-09'],
    ['2026-11-01T03:00:00Z', 'half:2026-10-16', '2026-10-31', 'month:2026-10'],
    ['2026-01-01T03:00:00Z', 'half:2025-12-16', '2025-12-31', 'month:2025-12'],
    ['2024-03-01T03:00:00Z', 'half:2024-02-16', '2024-02-29', 'month:2024-02'],
    ['2025-03-01T03:00:00Z', 'half:2025-02-16', '2025-02-28', 'month:2025-02'],
  ])('uses closed calendar ranges at %s', (now, halfId, end, monthId) => {
    const periods = summaryPeriods(new Date(now));
    expect(periods.halves[0]).toMatchObject({ id: halfId, to: end });
    expect(periods.months[0].id).toBe(monthId);
    expect(periods.halves).toHaveLength(24);
    expect(periods.months).toHaveLength(12);
    expect([...periods.halves, ...periods.months].every(period => period.to < periods.today)).toBe(true);
  });
  it('uses the business zone rather than the browser/server zone', () => {
    const now = new Date('2026-10-16T02:00:00Z');
    expect(summaryPeriods(now, 'Asia/Tokyo').halves[0].id).toBe('half:2026-10-01');
    expect(summaryPeriods(now).halves[0].id).toBe('half:2026-09-16');
    expect(summaryDay(now, 'America/Argentina/Buenos_Aires')).toBe('2026-10-15');
  });
  it.each(['half:2026-02-15', 'month:2026-13', 'month:2026-00', 'month:2026-01-01', 'half:2026-01', 'bad'])('rejects invalid period %s', id => {
    expect(() => summaryPeriod(id)).toThrow('El período no es válido');
  });
});

describe('audit summary math', () => {
  it.each([
    { status: 'CANCELADA', voidedAt: null, cancelledAt: null },
    { status: 'ANULADA', voidedAt: null, cancelledAt: null },
    { status: 'COMPLETADA', voidedAt: new Date(), cancelledAt: null },
    { status: 'PENDIENTE', voidedAt: null, cancelledAt: new Date() },
  ])('recognizes every cancellation representation', sale => expect(summarySaleVoided(sale)).toBe(true));
  it('keeps source currencies separate and rounds decimals', () => {
    expect(summaryAmounts([{ amount: .1, currency: 'USD' }, { amount: .2, currency: 'USD' }, { amount: 100, currency: 'ARS' }])).toEqual([{ amount: .3, currency: 'USD' }, { amount: 100, currency: 'ARS' }]);
  });
  it('does not classify legitimate sales during a count as discrepancies', () => {
    expect(stockSummaryLines({ missing: [], surplus: [], sold: [{ imei: '123', note: 'Se vendió durante el conteo' }, { imei: '456', model: 'Phone', note: 'Figura vendido' }] })).toEqual([{ imei: '456', title: 'Phone', status: 'Figura vendido' }]);
  });
  it('reports corrupt historical counts as errors instead of zero', () => {
    expect(() => stockSummaryLines(null)).toThrow();
    expect(() => stockSummaryLines({ missing: [] })).toThrow();
  });
});
