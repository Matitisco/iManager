import { describe, expect, it } from 'vitest';
import { combineAmounts, commitAmount, commitGroup, projectAmount } from './money';

describe('projectAmount', () => {
  it('reads a missing currency as the active store currency', () => {
    expect(projectAmount(1500, null, 'ARS', 1200)).toEqual({ value: 1500, currency: 'ARS', blocked: false });
    expect(projectAmount(100, '', 'USD', 1200)).toEqual({ value: 100, currency: 'USD', blocked: false });
  });

  it('converts with the sell rate and rounds to the nearest peso', () => {
    expect(projectAmount(100, 'USD', 'ARS', 1200)).toEqual({ value: 120000, currency: 'ARS', blocked: false });
    expect(projectAmount(120000, 'ARS', 'USD', 1200)).toEqual({ value: 100, currency: 'USD', blocked: false });
  });

  it('keeps the original currency when there is no sell rate', () => {
    expect(projectAmount(100, 'USD', 'ARS', null)).toEqual({ value: 100, currency: 'USD', blocked: true });
  });
});

describe('combineAmounts', () => {
  it('adds mixed currencies into the active one', () => {
    expect(combineAmounts([
      { amount: 1000, currency: 'ARS' },
      { amount: 2, currency: 'USD' },
      { amount: 500, currency: null },
    ], 'ARS', 1200)).toBe(3900);
  });

  it('returns null when any row cannot be converted', () => {
    expect(combineAmounts([
      { amount: 1000, currency: 'ARS' },
      { amount: 2, currency: 'USD' },
    ], 'ARS', null)).toBeNull();
  });
});

describe('commitAmount', () => {
  it('keeps the stored number when the form still shows the projected value', () => {
    expect(commitAmount(120000, 100, 'USD', 'ARS', 1200)).toEqual({ amount: 100, currency: 'USD' });
    expect(commitAmount(100, 100, null, 'ARS', null)).toEqual({ amount: 100, currency: null });
  });

  it('stamps the active currency only after the typed number changes', () => {
    expect(commitAmount(130000, 100, 'USD', 'ARS', 1200)).toEqual({ amount: 130000, currency: 'ARS' });
  });

  it('does not relabel an edited amount when conversion is blocked', () => {
    const group = commitGroup([
      { typed: 120, original: 100, currency: 'USD' },
    ], 'ARS', null);
    expect(group.blocked).toBe(true);
    expect(group.amounts).toEqual([{ amount: 100, currency: 'USD' }]);
  });

  it('saves every field in the active currency when one of them changes', () => {
    expect(commitGroup([
      { typed: 120000, original: 100, currency: 'USD' },
      { typed: 50000, original: 40, currency: 'USD' },
    ], 'ARS', 1200)).toEqual({
      blocked: false,
      amounts: [
        { amount: 120000, currency: 'ARS' },
        { amount: 50000, currency: 'ARS' },
      ],
    });
  });
});
