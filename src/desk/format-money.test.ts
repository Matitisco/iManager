import { describe, expect, it } from 'vitest';
import { formatInputMoney, formatMoney, formatMoneyInput, parseMoney } from './format';
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

describe('QA 05: centavos de cuotas y cobros', () => {
  it.each(['USD', 'ARS'] as const)('mantiene centavos con precisión explícita en %s', currency => {
    const prefix = currency === 'USD' ? 'US$' : '$';
    expect(formatMoney(366.66, currency, 2)).toBe(`${prefix} 366,66`);
    expect(formatMoney(366.68, currency, 2)).toBe(`${prefix} 366,68`);
    expect(formatMoney(733.34, currency, 2)).toBe(`${prefix} 733,34`);
    expect(formatMoney(-10.5, currency, 2)).toBe(currency === 'USD' ? 'US$ -10,50' : '$ -10,5');
    expect(formatMoney(366.66, currency)).toBe(currency === 'USD' ? 'US$ 366,66' : '$ 367');
    expect(formatMoney(100, currency, 2)).toBe(`${prefix} 100`);
  });
});

describe('#745: presentación USD sin redondear a entero', () => {
  it.each([
    [25.8, '25,80'], [1.5, '1,50'], [1.6, '1,60'], [25.81, '25,81'],
    [0.01, '0,01'], [-1.5, '-1,50'], [1234.5, '1.234,50'], [100, '100'], [0, '0'],
  ])('muestra %s USD como US$ %s', (amount, expected) => {
    expect(formatMoney(amount, 'USD')).toBe(`US$ ${expected}`);
    expect(formatMoney(amount, 'USD', 2)).toBe(`US$ ${expected}`);
  });

  it('conserva el formato ARS y la precisión explícita', () => {
    expect(formatMoney(25.8, 'ARS')).toBe('$ 26');
    expect(formatMoney(1.5, 'ARS')).toBe('$ 2');
    expect(formatMoney(1.5, 'ARS', 2)).toBe('$ 1,5');
    expect(formatMoney(25.8, 'USD', 0)).toBe('US$ 26');
  });
});
