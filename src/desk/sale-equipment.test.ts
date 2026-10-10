import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { equipmentSuggestions, EQUIPMENT_SUGGESTION_LIMIT, MISSING_OUTGOING_PRICE, NEGATIVE_TRADE_DIFFERENCE, outgoingTradeDifference } from './sale-equipment';

function product(id: string, model: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    imei: extra.imei ?? '',
    model,
    capacity: extra.capacity ?? '128GB',
    color: extra.color ?? '',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: extra.price ?? 500,
    status: 'DISPONIBLE',
  };
}

describe('equipmentSuggestions', () => {
  const items = [
    product('a', 'iPhone 13', { color: 'Azul', imei: '111122223333444' }),
    product('b', 'Samsung A54', { color: 'Negro' }),
    product('c', 'iPhone 11', { capacity: '64GB' }),
  ];

  it('stays empty until there is a query', () => {
    expect(equipmentSuggestions(items, '')).toEqual([]);
    expect(equipmentSuggestions(items, '   ')).toEqual([]);
  });

  it('matches model, capacity, color or imei and keeps the source order', () => {
    expect(equipmentSuggestions(items, 'iph').map((item) => item.id)).toEqual(['a', 'c']);
    expect(equipmentSuggestions(items, '64gb').map((item) => item.id)).toEqual(['c']);
    expect(equipmentSuggestions(items, 'negro').map((item) => item.id)).toEqual(['b']);
    expect(equipmentSuggestions(items, '3333444').map((item) => item.id)).toEqual(['a']);
  });

  it('returns a bounded list even when thousands of items match', () => {
    const many = Array.from({ length: 4000 }, (_, index) => product(`p${index}`, `iPhone ${index}`));
    const started = performance.now();
    const matches = equipmentSuggestions(many, 'iphone');
    expect(performance.now() - started).toBeLessThan(50);
    expect(matches).toHaveLength(EQUIPMENT_SUGGESTION_LIMIT);
    expect(matches.map((item) => item.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  });
});

describe('outgoingTradeDifference', () => {
  it('asks for the sale price instead of showing a negative gap when the device is not in stock', () => {
    expect(outgoingTradeDifference({
      registered: false,
      priceProvided: false,
      saleAmount: 0,
      takeValue: 500,
    })).toEqual({ difference: null, warning: MISSING_OUTGOING_PRICE });
  });

  it('warns only after a sale price was typed and it is below the trade-in', () => {
    expect(outgoingTradeDifference({
      registered: false,
      priceProvided: true,
      saleAmount: 100,
      takeValue: 250,
    })).toEqual({ difference: -150, warning: NEGATIVE_TRADE_DIFFERENCE });
    expect(outgoingTradeDifference({
      registered: true,
      priceProvided: true,
      saleAmount: 900,
      takeValue: 400,
    })).toEqual({ difference: 500, warning: null });
  });
});
