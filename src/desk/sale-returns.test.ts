import { expect, it } from 'vitest';
import type { ReturnCaseView } from '../services/returns-api';
import type { Sale } from '../types';
import { compensatedReturns, saleRevenueEntries } from './sale-returns';
const claim = (changes: Partial<ReturnCaseView> = {}): ReturnCaseView => ({ id: 'r', saleId: 's', status: 'EN_PROVEEDOR', resolution: 'CAMBIO', settlement: 'NOTA_CREDITO', moneyAmount: 1300, moneyCurrency: 'USD', compensatedOn: '2026-11-02', resolvedOn: '2026-11-05', ...changes } as ReturnCaseView);
it('reconoce RMA al compensar, con límites de período y sin sumar al cerrar', () => {
  const returns = [claim(), claim({ id: 'open', compensatedOn: null, resolvedOn: null }), claim({ id: 'void', status: 'ANULADO' }), claim({ id: 'repair', resolution: 'REPARACION' })];
  expect(compensatedReturns(returns, new Date(2026, 10, 2), new Date(2026, 10, 3)).map(r => r.id)).toEqual(['r']);
  expect(compensatedReturns(returns, new Date(2026, 10, 5), new Date(2026, 10, 6))).toEqual([]);
});
it('descuenta facturación en la fecha de compensación sin alterar la venta original', () => {
  const sale: Sale = { id: 's', clientId: 'c', productId: 'p', date: '2026-11-01', amount: 6500, amountCurrency: 'USD', cantidad: 10, paymentMethod: 'EFECTIVO', status: 'COMPLETADA' };
  const rows = saleRevenueEntries([sale], [claim()]);
  expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(5200);
  expect(rows[1]).toMatchObject({ amount: -1300, date: '2026-11-02', paymentMethod: 'EFECTIVO' });
  expect(sale).toMatchObject({ amount: 6500, cantidad: 10 });
});
