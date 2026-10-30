import { describe, expect, it } from 'vitest';
import { saleEquipment, saleQuantity, saleQuantityLabel } from './format';

describe('sale quantity formatting', () => {
  it.each([
    [1, 1, ''],
    [undefined, 1, ''],
    [0, 1, ''],
    [5, 5, 'x5'],
    [-2, 1, ''],
    [1.5, 1, ''],
    [NaN, 1, ''],
    [Infinity, 1, ''],
  ])('formats cantidad=%s as %s units and "%s"', (cantidad, units, label) => {
    expect(saleQuantity({ cantidad })).toBe(units);
    expect(saleQuantityLabel({ cantidad })).toBe(label);
  });

  it('keeps the equipment label independent of quantity', () => {
    const sale = { deviceLabel: 'iPhone 15', cantidad: 5 };
    expect(saleEquipment(sale, [])).toBe('iPhone 15');
  });
});
