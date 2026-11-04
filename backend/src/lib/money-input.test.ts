import { expect, it } from 'vitest';
import { moneyInput } from './money-input.js';

it.each([-1, 0.001, 100.005, 10_000_000_000, 1e100, Infinity, -Infinity, NaN, '100', null])(
  'rejects money that cannot be persisted faithfully: %s', value => {
    expect(moneyInput().safeParse(value).success).toBe(false);
  },
);
it.each([0, 0.01, 0.1 + 0.2, 1500.31 + 1e-10, 649.5, 9_999_999_999.99])('preserves representable money: %s', value => {
  expect(moneyInput().parse(value)).toBe(Math.round(value * 100) / 100);
});
it('requires a persisted positive cent for a payment or exchange rate', () => {
  expect(moneyInput({ positive: true }).safeParse(0).success).toBe(false);
  expect(moneyInput({ positive: true }).parse(0.01)).toBe(0.01);
});
