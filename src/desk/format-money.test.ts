import { describe, expect, it } from 'vitest';
import { formatInputMoney, formatMoneyInput, parseMoney } from './format';
import { commitAmount, commitGroup } from './money';

describe('QA 04: decimal money input', () => {
  it.each(['649,50', '649.50', '649,5', '649.5'])('preserves cents in %s', value => {
    expect(parseMoney(value)).toBe(649.5);
    expect(parseMoney(formatInputMoney(parseMoney(value)))).toBe(649.5);
    expect(commitGroup([{ typed: parseMoney(value), original: 650, currency: 'USD' }], 'USD', 1250).amounts[0]).toEqual({ amount: 649.5, currency: 'USD' });
    expect(commitAmount(parseMoney(value), 650, 'USD', 'USD', 1250)).toEqual({ amount: 649.5, currency: 'USD' });
  });
  it.each(['64.950', '64,950', '64950'])('preserves thousands in %s', value => {
    expect(parseMoney(value)).toBe(64950);
  });
  it.each(['1.234,56', '1,234.56'])('accepts grouped decimals %s', value => {
    expect(parseMoney(value)).toBe(1234.56);
  });
  it.each(['649,50', '649.50'])('preserves cents during typing %s', value => {
    let input = '';
    for (const char of value) input = formatMoneyInput(input + char);
    expect(input).toBe('649,50');
    expect(parseMoney(input)).toBe(649.5);
  });
  it('retains a stored decimal amount when unchanged', () => {
    expect(commitGroup([{ typed: 649.5, original: 649.5, currency: 'USD' }], 'USD', 1250).amounts[0].amount).toBe(649.5);
  });
});
