import { describe, expect, it } from 'vitest';
import { cancellationPlan, cancellationRefund, displayedSaleDue, type RefundTarget } from './cancel-refund';

function sale(overrides: Partial<RefundTarget> = {}): RefundTarget {
  return { id: 'sale', cash: 900, status: 'PENDIENTE', openBalance: null, soldAt: '2026-10-01', ...overrides };
}

describe('cancellationRefund', () => {
  it('returns the payment recorded on that sale', () => {
    const target = sale();
    expect(cancellationRefund(target, [target], [{ saleId: 'sale', kind: 'PAGO', amount: 300 }])).toBe(300);
  });

  it('returns zero when nothing was collected', () => {
    const target = sale();
    expect(cancellationRefund(target, [target], [])).toBe(0);
    expect(cancellationRefund(target, [target], [{ kind: 'CARGO', amount: 1100 }])).toBe(0);
  });

  it('keeps a general payment out of the cash refund', () => {
    const target = sale({ cash: 100, openBalance: 100 });
    const plan = cancellationPlan(target, [target], [{ kind: 'PAGO', amount: 100 }, { kind: 'CARGO', amount: 35 }], 35);
    expect(plan.refund).toBe(0);
    expect(plan.credit).toBe(100);
  });

  it('keeps a balance typed on the client out of the cash refund', () => {
    const target = sale({ cash: 950, openBalance: null, status: 'PENDIENTE' });
    expect(cancellationPlan(target, [target], [{ kind: 'PAGO', amount: 300 }], 700)).toEqual({ refund: 0, credit: 300 });
  });

  it('spends a general payment once and shows the covered sale at the remaining debt', () => {
    const older = sale({ id: 'older', cash: 100, openBalance: 100, soldAt: '2026-09-01' });
    const newer = sale({ id: 'newer', cash: 30, openBalance: 30, soldAt: '2026-10-01' });
    const movements = [{ kind: 'PAGO', amount: 30 }, { kind: 'CARGO', amount: 35 }];
    expect(displayedSaleDue(older, [older, newer], movements, 135)).toBe(70);
    expect(cancellationPlan(older, [older, newer], movements, 135)).toEqual({ refund: 0, credit: 30 });
    expect(cancellationPlan(newer, [newer], [
      ...movements,
      { kind: 'CREDITO', amount: 30, saleId: 'older' },
    ], 65)).toEqual({ refund: 0, credit: 0 });
    expect(displayedSaleDue(newer, [newer], [
      ...movements,
      { kind: 'CREDITO', amount: 30, saleId: 'older' },
    ], 65)).toBe(30);
  });

  it('assigns a general payment to the oldest open sale', () => {
    const older = sale({ id: 'older', cash: 80, openBalance: 80, soldAt: '2026-09-01' });
    const newer = sale({ id: 'newer', cash: 100, openBalance: 100, soldAt: '2026-10-01' });
    expect(cancellationPlan(newer, [older, newer], [{ kind: 'PAGO', amount: 50 }], 130)).toEqual({ refund: 0, credit: 0 });
    expect(cancellationPlan(older, [older, newer], [{ kind: 'PAGO', amount: 50 }], 130)).toEqual({ refund: 0, credit: 50 });
  });

  it('refunds a collected operation and ignores a later price increase', () => {
    const target = sale({ cash: 150, status: 'COMPLETADA', openBalance: 50 });
    expect(cancellationRefund(target, [target], [{ saleId: 'sale', kind: 'PAGO', amount: 100 }, { saleId: 'sale', kind: 'CARGO', amount: 50 }])).toBe(100);
  });
});
