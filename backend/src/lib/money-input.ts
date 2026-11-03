import { z } from 'zod';

/** Decimal(12,2) values. Allow floating point arithmetic noise, never subcent money. */
export function moneyInput({ positive = false, max = 9_999_999_999.99 }: { positive?: boolean; max?: number } = {}) {
  return z.number().finite().min(positive ? 0.01 : 0).max(max).refine(value => {
    const rounded = Math.round(value * 100) / 100;
    return Math.abs(value - rounded) <= Math.max(1e-8, Number.EPSILON * Math.max(1, value) * 2);
  }, 'Usá hasta dos decimales').transform(value => Math.round(value * 100) / 100);
}
