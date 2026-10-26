import { describe, expect, it } from 'vitest';
import type { Client } from '../types';
import { combinedClientSpending, importedClientSpending } from './client-spending';
const client = { totalSpent: 99999, importedSpent: 2400, importedSpentCurrency: 'USD' } as Client;
describe('opening client spending', () => {
  it('combines explicit history once and ignores the legacy accumulator', () => {
    expect(combinedClientSpending([{ amount: 750, currency: 'USD' }], client)).toEqual([{ amount: 3150, currency: 'USD' }]);
    expect(combinedClientSpending([], client)).toEqual([{ amount: 2400, currency: 'USD' }]);
  });
  it('keeps currencies separate and does not invent missing history', () => {
    expect(combinedClientSpending([{ amount: 500, currency: 'ARS' }], client)).toEqual([{ amount: 500, currency: 'ARS' }, { amount: 2400, currency: 'USD' }]);
    expect(importedClientSpending({ totalSpent: 99999 } as Client)).toEqual([]);
    expect(importedClientSpending({ ...client, importedSpentCurrency: null })).toEqual([]);
    expect(importedClientSpending({ ...client, importedSpent: 0 })).toEqual([{ amount: 0, currency: 'USD' }]);
  });
});
