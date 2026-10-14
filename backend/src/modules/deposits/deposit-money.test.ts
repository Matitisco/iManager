import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { depositValue } from './deposit-money.js';
const ars = { amount: new Decimal(100000), currency: 'ARS', usdAmount: new Decimal(100) };
const usd = { amount: new Decimal(100.25), currency: 'USD', usdAmount: new Decimal(100.25) };
describe('frozen deposit money', () => {
  it('keeps the original ARS nominal amount', () => expect(Number(depositValue(ars, 'ARS', 2000))).toBe(100000));
  it('uses the frozen USD equivalent after a quote change', () => expect(Number(depositValue(ars, 'USD', 2000))).toBe(100));
  it('converts USD to ARS only at the explicit application quote', () => expect(Number(depositValue(usd, 'ARS', 1200))).toBe(120300));
  it('keeps USD cents with no quote', () => expect(Number(depositValue(usd, 'USD'))).toBe(100.25));
  it('rounds cross currency to cents', () => expect(Number(depositValue({ ...usd, usdAmount: 10.01 }, 'ARS', 1.005))).toBe(10.06));
  it.each([0, -1, NaN, Infinity, undefined])('rejects missing/invalid USD to ARS quotes %s', rate => expect(() => depositValue(usd, 'ARS', rate)).toThrow('cotización válida'));
  it('rejects unsupported currencies', () => expect(() => depositValue(ars, 'EUR', 1000)).toThrow('Moneda inválida'));
});
