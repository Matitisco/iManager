import { describe, expect, it } from 'vitest';
import { cancellationRefund, type RefundTarget } from './cancel-refund';

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

  it('refunds a collected operation and ignores a later price increase', () => {
    const target = sale({ cash: 150, status: 'COMPLETADA', openBalance: 50 });
    expect(cancellationRefund(target, [target], [{ saleId: 'sale', kind: 'PAGO', amount: 100 }, { saleId: 'sale', kind: 'CARGO', amount: 50 }])).toBe(100);
  });
});
