import { describe, expect, it } from 'vitest';
import { saleDetailAmounts } from './sale-detail-money';

describe('sale detail currency presentation', () => {
  it('keeps the remaining USD debt and installments in USD with ARS equivalents', () => {
    expect(saleDetailAmounts(70, 'USD', 'USD', 'ARS', 1565)).toEqual({ primary: 'US$ 70', secondary: '$ 109.550' });
    expect(saleDetailAmounts(20, 'USD', 'USD', 'ARS', 1565)).toEqual({ primary: 'US$ 20', secondary: '$ 31.300' });
    expect(saleDetailAmounts(50, 'USD', 'USD', 'ARS', 1565)).toEqual({ primary: 'US$ 50', secondary: '$ 78.250' });
  });
  it('projects the same debt into the store currency without treating pesos as dollars', () => {
    expect(saleDetailAmounts(70, 'USD', 'ARS', 'USD', 1565)).toEqual({ primary: '$ 109.550', secondary: 'US$ 70' });
    expect(saleDetailAmounts(31300, 'ARS', 'USD', 'ARS', 1565)).toEqual({ primary: 'US$ 20', secondary: '$ 31.300' });
  });
  it('preserves cents and fully paid installments', () => {
    expect(saleDetailAmounts(366.68, 'USD', 'USD', 'ARS', 1250)).toEqual({ primary: 'US$ 366,68', secondary: '$ 458.350' });
    expect(saleDetailAmounts(0, 'USD', 'ARS', 'USD', 1565)).toEqual({ primary: '$ 0', secondary: 'US$ 0' });
  });
  it.each([null, 0, -1, Infinity, NaN])('keeps the original currency without a valid rate (%s)', rate => {
    expect(saleDetailAmounts(70.25, 'USD', 'ARS', 'USD', rate)).toEqual({ primary: 'US$ 70,25', secondary: null });
    expect(saleDetailAmounts(70.25, 'USD', 'USD', 'ARS', rate)).toEqual({ primary: 'US$ 70,25', secondary: null });
  });
  it('does not add a redundant secondary currency', () => {
    expect(saleDetailAmounts(70, 'USD', 'USD', null, 1565)).toEqual({ primary: 'US$ 70', secondary: null });
  });
});
