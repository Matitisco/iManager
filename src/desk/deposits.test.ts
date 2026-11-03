import { describe, expect, it } from 'vitest';
import { depositAmount, initialDepositPreview } from './deposits';
describe('deposit application display', () => {
  const receipt = { amount: 100000, currency: 'ARS' as const, usdAmount: 100 };
  it('keeps ARS nominal amount when the quote changes', () => expect(depositAmount(receipt, 'ARS', 2000)).toBe(100000));
  it('keeps the frozen USD equivalent when the quote changes', () => expect(depositAmount(receipt, 'USD', 2000)).toBe(100));
  it('does not require a current quote to apply an ARS receipt in USD', () => expect(depositAmount(receipt, 'USD', null)).toBe(100));
  it('requires a current quote for USD to ARS', () => expect(depositAmount({ ...receipt, currency: 'USD', amount: 100 }, 'ARS', null)).toBeNull());
  it('rounds USD to ARS to two decimals', () => expect(depositAmount({ amount: 10.01, currency: 'USD', usdAmount: 10.01 }, 'ARS', 1.005)).toBe(10.06));
});
describe('initial deposit preview', () => {
  it.each([
    [100000, 'ARS', 'USD', 500, 400],
    [100.25, 'USD', 'ARS', 500000, 399750],
    [100005, 'ARS', 'USD', 500, 399.99],
    [100.25, 'USD', 'USD', 100.25, 0],
  ] as const)('shows the same remainder as the receipt snapshot', (amount, currency, saleCurrency, remaining, balance) => {
    expect(initialDepositPreview(amount, currency, saleCurrency, 1000, remaining)).toEqual({ error: null, balance });
  });
  it('rejects overpayment, zero, missing quote and a zero USD equivalent', () => {
    for (const [amount, currency, saleCurrency, rate, remaining] of [[101, 'USD', 'USD', 1000, 100], [0, 'USD', 'USD', 1000, 100], [10, 'USD', 'USD', null, 100], [1, 'ARS', 'USD', 1000, 100]] as const) {
      expect(initialDepositPreview(amount, currency, saleCurrency, rate, remaining).error).toBeTruthy();
    }
  });
});
