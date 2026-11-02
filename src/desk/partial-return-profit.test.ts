import { describe, expect, it } from 'vitest';
import { partialReturn } from '../test/return-fixtures';
import type { Sale } from '../types';
import { summarizeSaleProfit } from './sale-profit';
import { billingEntries, compensatedReturns } from './return-financials';
import { clientPurchases, purchaseTotals } from './client-purchases';
import { clientSpendingById } from './client-spending';
import { netProfit, returnReversal } from './net-profit';

const sales: Sale[] = [{ id: 's', clientId: 'c1', productId: 'p', date: '2026-10-01', cantidad: 10, amount: 1000, amountCurrency: 'USD', status: 'COMPLETADA', paymentMethod: 'EFECTIVO' }];
const inventory = [{ id: 'p', cost: 60, currency: 'USD' }];

describe('devolución parcial compartida por las cuatro vistas', () => {
  it.each(['REINTEGRO', 'NOTA_CREDITO'])('resta 200 de facturación y 80 de ganancia: %s', settlement => {
    const returns = [partialReturn({ settlement })];
    expect(summarizeSaleProfit(sales, inventory, 'USD', 1000, returns)).toMatchObject({ revenue: 800, grossProfit: 320, marginPct: 40 });
    expect(billingEntries(sales, returns).reduce((sum, sale) => sum + sale.amount, 0)).toBe(800);
    expect(purchaseTotals(clientPurchases({ clientId: 'c1', sales, inventory: [], repairs: [], tradeIns: [], sellers: [], returns }), 'USD').spent).toEqual([{ currency: 'USD', amount: 800 }]);
    expect(clientSpendingById(sales, [], 'USD', returns).get('c1')).toEqual([{ currency: 'USD', amount: 800 }]);
    expect(netProfit({ currency: 'USD', sellRate: 1000, sales: [{ amount: 1000, currency: 'USD', cost: 600, costCurrency: 'USD' }], expenses: [], returns: returns.map(returnReversal) })).toMatchObject({ revenue: 800, cost: 480, grossProfit: 320 });
  });

  it('registra la compensación en su período, aunque la venta sea anterior', () => {
    const returns = [partialReturn({ compensatedOn: '2026-11-02' })];
    expect(billingEntries(sales, returns).map(row => [row.date, row.amount])).toEqual([['2026-10-01', 1000], ['2026-11-02', -200]]);
    expect(summarizeSaleProfit([], inventory, 'USD', 1000, returns)).toMatchObject({ revenue: -200, grossProfit: -80 });
  });

  it.each([
    { status: 'ANULADO' }, { deletedAt: '2026-10-03' }, { resolution: 'REPARACION' },
    { compensatedOn: null, resolvedOn: null }, { settlement: 'NINGUNO' },
  ])('ignora reclamos sin compensación válida: %j', flags => {
    const returns = [partialReturn(flags)];
    expect(compensatedReturns(returns)).toEqual([]);
    expect(summarizeSaleProfit(sales, inventory, 'USD', null, returns)).toMatchObject({ revenue: 1000, grossProfit: 400 });
  });

  it('convierte costo y devolución por separado y bloquea sin cotización', () => {
    const returns = [partialReturn({ itemCost: 60000, itemCurrency: 'ARS' })];
    expect(summarizeSaleProfit(sales, [{ id: 'p', cost: 60000, currency: 'ARS' }], 'USD', 1000, returns)).toMatchObject({ revenue: 800, grossProfit: 320 });
    expect(summarizeSaleProfit([], [], 'USD', null, returns).grossProfit).toBeNull();
    expect(summarizeSaleProfit([], [], 'ARS', null, returns).revenue).toBeNull();
  });

  it('mantiene el default histórico de una unidad y no inventa margen sin costo', () => {
    expect(returnReversal(partialReturn({ saleQuantity: undefined, saleAmount: 100, moneyAmount: 20 }))).toMatchObject({ amount: 20, cost: 12 });
    expect(summarizeSaleProfit([], [], 'USD', null, [partialReturn({ itemCost: 0 })])).toMatchObject({ revenue: -200, grossProfit: 0 });
  });

  it('acumula compensaciones y solo modifica la compra asociada al cliente', () => {
    const returns = [partialReturn({ moneyAmount: 100 }), partialReturn({ id: 'r2', moneyAmount: 100 })];
    const otherSale = { ...sales[0], id: 'other', clientId: 'c2', amount: 500 };
    const spending = clientSpendingById([...sales, otherSale], [], 'USD', returns);
    expect(spending.get('c1')).toEqual([{ currency: 'USD', amount: 800 }]);
    expect(spending.get('c2')).toEqual([{ currency: 'USD', amount: 500 }]);
    expect(summarizeSaleProfit(sales, inventory, 'USD', null, returns)).toMatchObject({ revenue: 800, grossProfit: 320 });
  });
});
