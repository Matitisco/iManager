import { describe, expect, it } from 'vitest';
import { saleCostInput } from './sale-cost-input.js';

describe('costo unitario de venta', () => {
  it.each([undefined, null, '', '   '])('vacío %j conserva costo', value => {
    expect(saleCostInput.parse(value)).toBeUndefined();
  });
  it.each([0, 900.12, 9999999999.99])('acepta decimal %s', value => {
    expect(saleCostInput.parse(value)).toBe(value);
  });
  it.each([-1, 1.001, Infinity, NaN, 10000000000, '900.12'])('rechaza costo inválido %s', value => {
    expect(saleCostInput.safeParse(value).success).toBe(false);
  });
});
