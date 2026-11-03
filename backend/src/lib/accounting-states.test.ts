import { describe, expect, it } from 'vitest';
import { ACCOUNTING_STATES, isSaleCancelled, normalizeAccountingState, saleStateSchema, tradeStateSchema } from './accounting-states.js';
import { commissionForSale } from '../modules/commissions/commission-math.js';
import { refundableAmount } from '../modules/returns/returns-math.js';

describe('estados contables por dominio', () => {
  it.each(Object.entries(ACCOUNTING_STATES).flatMap(([domain, states]) => states.map(state => [domain, state])))('tolera espacios y mayúsculas: %s/%s', (domain, state) => {
    expect(normalizeAccountingState(domain as keyof typeof ACCOUNTING_STATES, ` ${state.toLowerCase()} `)).toBe(state);
  });
  it.each(['ANULADA', 'anulado', ' cancelled ', 'CANCELED', 'cancelado'])('excluye %s de comisión y compensación', status => {
    expect(isSaleCancelled(status)).toBe(true);
    expect(commissionForSale({ sellerMemberId: 'm', status, amount: 100, cost: 20, takeValue: 0, currency: 'USD', exchangeRate: 1000 }, { id: 'r', memberId: null, basis: 'SALE_PERCENT', rate: 10, currency: null, effectiveFrom: new Date(), createdAt: new Date() })).toBe(0);
    expect(refundableAmount({ status, amount: 100, openBalance: 0 })).toBe(0);
  });
  it('valida ventas, conserva estados personalizados y no infiere cobros', () => {
    expect(saleStateSchema.parse(' pending ')).toBe('PENDIENTE');
    expect(saleStateSchema.safeParse('INVENTADO').success).toBe(false);
    expect(tradeStateSchema.parse('Mi peritaje')).toBe('Mi peritaje');
    expect(normalizeAccountingState('sale', 'APROBADO')).toBe('APROBADO');
    expect(refundableAmount({ status: 'APROBADO', amount: 100, openBalance: 0 })).toBe(0);
    expect(refundableAmount({ status: ' completed ', amount: 100, openBalance: null })).toBe(100);
  });
});
