import { describe, expect, it } from 'vitest';
import { calculateCatalogPrice, convertCatalogPrice } from './rules.js';
import { catalogEditSchema } from './schema.js';

const base = { mode: 'LIST_PERCENT', percent: 0, list: '100.25', cost: '60.10', currency: 'USD' };
describe('catalog price rules', () => {
  it('defaults to the original list price', () => {
    expect(calculateCatalogPrice(base)).toEqual({ price: 100.25, currency: 'USD' });
  });
  it('applies negative discounts and rounds half up', () => {
    expect(calculateCatalogPrice({ ...base, percent: -10 })).toEqual({ price: 90.23, currency: 'USD' });
    expect(calculateCatalogPrice({ ...base, percent: -100 }).price).toBe(0);
  });
  it('applies markup to cost and never falls back to list for missing cost', () => {
    expect(calculateCatalogPrice({ ...base, mode: 'COST_PERCENT', percent: 25 }).price).toBe(75.13);
    expect(calculateCatalogPrice({ ...base, mode: 'COST_PERCENT', cost: null }).price).toBeNull();
    expect(calculateCatalogPrice({ ...base, mode: 'COST_PERCENT', cost: 0 }).price).toBe(0);
  });
  it('uses manual price and its currency, or unadjusted list when missing', () => {
    expect(calculateCatalogPrice({ ...base, mode: 'MANUAL', percent: 50, manual: { price: '130006.50', currency: 'ARS' }, target: 'USD', rate: 1300 })).toEqual({ price: 100.01, currency: 'USD' });
    expect(calculateCatalogPrice({ ...base, mode: 'MANUAL', percent: 50 }).price).toBe(100.25);
    expect(calculateCatalogPrice({ ...base, mode: 'MANUAL', manual: { price: 0, currency: 'ARS' } }).price).toBe(0);
    expect(calculateCatalogPrice({ ...base, mode: 'MANUAL', list: null }).price).toBeNull();
  });
  it('rounds once after adjustment and currency conversion', () => {
    expect(calculateCatalogPrice({ ...base, percent: -10, target: 'ARS', rate: 1300 }).price).toBe(117292.50);
    expect(convertCatalogPrice(130006.5, 'ARS', 'USD', 1300)).toBe(100.01);
    expect(convertCatalogPrice(0.1, 'USD', 'ARS', 1300)).toBe(130);
  });
  it.each([{ priceAdjustPercent: -101 }, { priceAdjustPercent: 1.001 }, { priceAdjustPercent: Infinity }, { manualPrices: [{ inventoryItemId: 'fake', price: -1, currency: 'USD' }] }, { manualPrices: [{ inventoryItemId: 'fake', price: 1.001, currency: 'USD' }] }, { cost: 10 }, { slug: 'change-old-link' }])('rejects invalid or private inputs: %j', input => {
    expect(catalogEditSchema.safeParse(input).success).toBe(false);
  });
});
