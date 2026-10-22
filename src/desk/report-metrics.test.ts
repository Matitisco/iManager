import { describe, expect, it } from 'vitest';
import type { Product, RepairOrder, Sale } from '../types';
import { customReportBounds } from './report-period';
import { durationText, reportDelta, reportSum, serviceSummary, stockSummary } from './report-metrics';
const bounds = customReportBounds('2026-10-01', '2026-10-21').bounds!;
const project = (amount: number, currency?: string | null) => currency === 'USD' ? null : amount;
const item = (id: string, createdAt?: string, status = 'DISPONIBLE') => ({ id, createdAt, status, price: 100, currency: 'ARS' } as Product);
const sale = (id: string, productId: string, date: string, status = 'COMPLETADA') => ({ id, productId, date, status } as Sale);
const order = (id: string, receivedAt: string, estimate: number | null, status = 'RECIBIDO', events: RepairOrder['events'] = []) => ({ id, receivedAt, estimate, currency: 'ARS', status, events } as RepairOrder);

describe('semantic report deltas', () => {
  it.each([[112, 100, 'up', 'positive', '↑ 12 %'], [40, 100, 'down', 'negative', '↓ 60 %'], [100, 100, 'equal', 'neutral', '= Igual']] as const)('compares %s with %s', (current, previous, direction, tone, text) => {
    expect(reportDelta(current, previous, 'los 30 días anteriores')).toMatchObject({ direction, tone, text: expect.stringContaining(text) });
  });
  it.each([[18, 15, '↑ 3'], [12, 15, '↓ 3']] as const)('keeps count changes neutral', (current, previous, text) => {
    expect(reportDelta(current, previous, 'los 30 días anteriores', 'count')).toMatchObject({ tone: 'neutral', unit: 'count', magnitude: 3, text: expect.stringContaining(text) });
  });
  it('never fabricates a percentage without a base or conversion', () => {
    for (const [current, previous] of [[5, 0], [null, 10], [10, null], [NaN, 2]]) {
      const delta = reportDelta(current, previous, 'el período anterior');
      expect(delta.tone).toBe('neutral'); expect(delta.direction).toBe('unavailable'); expect(delta.text).not.toContain('%');
    }
    expect(reportDelta(0, 0, 'el período anterior').text).toContain('Igual');
  });
  it('preserves sub-percent direction and signed prior adjustments', () => {
    expect(reportDelta(999.99, 1000, 'el mes anterior')).toMatchObject({ direction: 'down', text: expect.stringContaining('↓ < 1 %') });
    expect(reportDelta(1000.01, 1000, 'el mes anterior').text).toContain('↑ < 1 %');
    expect(reportDelta(-20, -10, 'el mes anterior')).toMatchObject({ direction: 'down', tone: 'negative', magnitude: 100 });
  });
  it('propagates missing FX in either cohort, preserving valid zero', () => {
    expect(reportSum([{ amount: 1, currency: 'ARS' }, { amount: 2, currency: 'USD' }], project)).toBeNull();
    expect(reportSum([{ amount: 0, currency: 'ARS' }], project)).toBe(0);
  });
});

describe('stock populations', () => {
  it('keeps current snapshot independent from entry cohort and measures linked eligible sales', () => {
    const inventory = [item('old', '2026-09-30'), item('new', '2026-10-01', 'VENDIDO'), item('undated'), item('invalid', '2026-02-30')];
    const sales = [sale('s1', 'old', '2026-10-02'), sale('s2', 'new', '2026-10-04'), sale('missing', 'unknown', '2026-10-10'), sale('void', 'old', '2026-10-12', 'CANCELADA')];
    expect(stockSummary(inventory, sales, bounds, project)).toMatchObject({ entries: 1, previous: 1, available: 3, saleValue: 300, undated: 2, measured: 2, sold: 3, averageDays: 2.5 });
  });
  it('does not invent durations or currency values from incomplete data', () => {
    const inventory = [{ ...item('p1'), currency: 'USD' }];
    expect(stockSummary(inventory, null, bounds, project)).toMatchObject({ averageDays: null, saleValue: null });
    expect(stockSummary(inventory, [sale('s1', 'p1', '2026-10-01')], bounds, project).averageDays).toBeNull();
    expect(durationText(null)).toBe('No disponible'); expect(durationText(3.2)).toBe('3,2 días');
  });
});

describe('received repair cohorts', () => {
  it('includes quoted zero, separates unquoted and uses only valid delivered events', () => {
    const orders = [order('quoted', '2026-10-01', 100, 'ENTREGADO', [{ id: 'e', status: 'ENTREGADO', createdAt: '2026-10-04T04:48:00-03:00' }]),
      order('zero', '2026-10-02', 0), order('unquoted', '2026-10-03', null), order('missing', '2026-10-04', 200, 'ENTREGADO'), order('prior', '2026-09-30', 150)];
    expect(serviceSummary(orders, bounds, project)).toMatchObject({ received: 4, quoted: 3, unquoted: 1, budget: 300, previousBudget: 150, delivered: 2, deliveredBudget: 300, averageDays: 3.2, measured: 1 });
  });
  it('preserves unavailable conversion in previous budgets', () => {
    const summary = serviceSummary([{ ...order('prior', '2026-09-30', 100), currency: 'USD' }, order('current', '2026-10-02', 0)], bounds, project);
    expect(summary.budget).toBe(0); expect(summary.previousBudget).toBeNull();
  });
});
