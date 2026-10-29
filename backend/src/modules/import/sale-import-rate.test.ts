import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaleReviewRow } from './sale-import-row.js';
vi.unmock('./sale-import-quotes.js');
vi.mock('../../lib/blue-rate.js', () => ({ currentBlueRate: vi.fn(async () => 1500) }));

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('sale import currency review', () => {
  it('uses the exact sale-day quote, explicitly falls back to today and freezes the reviewed quote', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      { fecha: '2024-01-10', venta: 1000 },
      { fecha: '2024-01-11', venta: 0 },
      { fecha: '2024-02-31', venta: 1100 },
    ])));
    vi.stubGlobal('fetch', fetchMock);
    const { priceSaleReviewRows } = await import('./sale-import-rate.js');
    const rows: SaleReviewRow[] = [
      { date: '10/01/2024', amount: '500000', currency: 'ARS' },
      { date: '11/01/2024', amount: '900000', currency: 'ARS' },
      { date: '10/01/2024', amount: '900', currency: 'USD' },
      { date: '10/01/2024', amount: '500000', currency: 'ARS', _possibleTotal: 'true' },
    ];
    await priceSaleReviewRows(rows);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows[0]).toMatchObject({ _amountUsd: '500.00', _exchangeRate: '1000', _rateDate: '10/01/2024', _rateSource: 'historical' });
    expect(rows[1]).toMatchObject({ _amountUsd: '600.00', _exchangeRate: '1500', _rateSource: 'today' });
    expect(rows[1]._review).toContain('Sin cotización histórica para 11/01/2024');
    expect(rows[1]._review).toContain('se usa la de hoy');
    expect(rows[2]).toEqual({ date: '10/01/2024', amount: '900', currency: 'USD' });
    expect(rows[3]._amountUsd).toBe('0.00');
    await priceSaleReviewRows(rows, true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows[0]._amountUsd).toBe('500.00');
  });

  it.each(['network', 'invalid', 'status'])('reports today fallback when history fails (%s)', async mode => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (mode === 'network') throw new Error('offline');
      return new Response(mode === 'invalid' ? '{}' : '', { status: mode === 'status' ? 503 : 200 });
    }));
    const { priceSaleReviewRows } = await import('./sale-import-rate.js');
    const rows: SaleReviewRow[] = [{ date: '10/01/2024', amount: '750000', currency: 'ARS' }];
    await priceSaleReviewRows(rows);
    expect(rows[0]).toMatchObject({ _amountUsd: '500.00', _rateSource: 'today', _exchangeRate: '1500' });
    expect(rows[0]._review).toContain('se usa la de hoy');
  });
});
