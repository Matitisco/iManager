import { describe, expect, it } from 'vitest';
import type { Sale } from '../types';
import { summarizeSaleProfit } from './sale-profit';

const sale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 's', date: '2026-10-01', clientId: '', productId: 'p',
  amount: 800, amountCurrency: 'USD', cantidad: 5,
  status: 'COMPLETADA', paymentMethod: 'EFECTIVO', ...overrides,
});
const inventory = [{ id: 'p', cost: 100, currency: 'USD' }];

describe('summarizeSaleProfit', () => {
  it('subtracts unit cost times five from the sale total', () => {
    expect(summarizeSaleProfit([sale()], inventory, 'USD', 1000)).toMatchObject({
      grossProfit: 300, marginRevenue: 800, marginPct: 38, costedSales: 1, salesWithoutCost: 0,
    });
  });

  it.each([['USD', 700, 1800], ['ARS', 700000, 1800000]] as const)(
    'converts sale and equipment currencies independently to %s', (active, grossProfit, marginRevenue) => {
      expect(summarizeSaleProfit([
        sale({ amount: 800000, amountCurrency: 'ARS' }),
        sale({ productId: 'ars', amount: 1000 }),
      ], [...inventory, { id: 'ars', cost: 120000, currency: 'ARS' }], active, 1000))
        .toMatchObject({ grossProfit, marginRevenue, marginPct: 39 });
    },
  );

  it('excludes absent, zero and negative costs from profit and the percentage denominator', () => {
    const result = summarizeSaleProfit([
      sale(), sale({ productId: 'missing' }), sale({ productId: 'zero' }), sale({ productId: 'negative' }),
    ], [...inventory, { id: 'zero', cost: 0 }, { id: 'negative', cost: -1 }], 'USD', 1000);
    expect(result).toMatchObject({ grossProfit: 300, marginRevenue: 800, marginPct: 38, salesWithoutCost: 3 });
  });

  it.each([{ status: 'ANULADA' }, { status: 'CANCELADA' }, { voidedAt: '2026-10-02' }])(
    'excludes voided sales (%j)', flags => {
      expect(summarizeSaleProfit([sale(flags)], inventory, 'USD', null))
        .toMatchObject({ grossProfit: 0, marginRevenue: 0, costedSales: 0, salesWithoutCost: 0 });
    },
  );

  it.each([undefined, 0, -1, NaN, Infinity, 1.5])('uses one unit for quantity %s', cantidad => {
    expect(summarizeSaleProfit([sale({ cantidad })], inventory, 'USD', null).grossProfit).toBe(700);
  });

  it('includes pending sales from the non-voided period summary', () => {
    expect(summarizeSaleProfit([sale({ status: 'PENDIENTE' })], inventory, 'USD', null).grossProfit).toBe(300);
  });

  it('preserves losses', () => {
    expect(summarizeSaleProfit([sale({ amount: 400 })], inventory, 'USD', null))
      .toMatchObject({ grossProfit: -100, marginPct: -25 });
  });

  it('blocks profit when a required conversion has no quote', () => {
    expect(summarizeSaleProfit([sale()], inventory, 'ARS', null))
      .toMatchObject({ grossProfit: null, marginRevenue: null, marginPct: null });
  });

  it('does not require conversion for excluded unknown costs', () => {
    expect(summarizeSaleProfit([sale({ productId: 'missing' })], inventory, 'ARS', null))
      .toMatchObject({ grossProfit: 0, marginPct: 0, salesWithoutCost: 1 });
  });

  it('rounds the converted unit cost before multiplying, like reports', () => {
    expect(summarizeSaleProfit([sale()], [{ id: 'p', cost: 100499, currency: 'ARS' }], 'USD', 1000).grossProfit).toBe(300);
  });
});
