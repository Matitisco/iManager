import { describe, expect, it } from 'vitest';
import { depositAmount } from './deposits';
describe('deposit application display', () => {
  const receipt = { amount: 100000, currency: 'ARS' as const, usdAmount: 100 };
  it('keeps ARS nominal amount when the quote changes', () => expect(depositAmount(receipt, 'ARS', 2000)).toBe(100000));
  it('keeps the frozen USD equivalent when the quote changes', () => expect(depositAmount(receipt, 'USD', 2000)).toBe(100));
  it('does not require a current quote to apply an ARS receipt in USD', () => expect(depositAmount(receipt, 'USD', null)).toBe(100));
  it('requires a current quote for USD to ARS', () => expect(depositAmount({ ...receipt, currency: 'USD', amount: 100 }, 'ARS', null)).toBeNull());
  it('rounds USD to ARS to two decimals', () => expect(depositAmount({ amount: 10.01, currency: 'USD', usdAmount: 10.01 }, 'ARS', 1.005)).toBe(10.06));
});
