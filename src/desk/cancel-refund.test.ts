import { describe, expect, it } from 'vitest';
import { cancellationRefund } from './cancel-refund';

describe('cancellationRefund', () => {
  it('matches the partial payment from the issue', () => {
    expect(cancellationRefund('PENDIENTE', 900, 600)).toBe(300);
  });

  it('returns zero when nothing was collected', () => {
    expect(cancellationRefund('PENDIENTE', 900, 900)).toBe(0);
    expect(cancellationRefund('PENDIENTE', 900, 1100)).toBe(0);
  });

  it('refunds a collected operation in full', () => {
    expect(cancellationRefund('COMPLETADA', 900, 200)).toBe(900);
  });
});
