import { describe, expect, it } from 'vitest';
import { netProfit } from './net-profit';

describe('ganancia neta', () => {
  it('resta los gastos ya convertidos con el dólar venta', () => {
    const figures = netProfit({
      currency: 'ARS',
      sellRate: 1300,
      sales: [
        { amount: 100000, currency: 'ARS', cost: 40000, costCurrency: 'ARS' },
        { amount: 100, currency: 'USD', cost: 20, costCurrency: 'USD' },
      ],
      expenses: [
        { amount: 10, currency: 'USD' },
        { amount: 5000, currency: 'ARS' },
      ],
    });
    expect(figures).toEqual({ revenue: 230000, cost: 66000, grossProfit: 164000, expenses: 18000, netProfit: 146000 });
  });

  it('proyecta un gasto en pesos cuando la tienda está en dólares', () => {
    const figures = netProfit({
      currency: 'USD',
      sellRate: 1000,
      sales: [{ amount: 100, currency: 'USD', cost: 40000, costCurrency: 'ARS' }],
      expenses: [{ amount: 2000, currency: 'ARS' }],
    });
    expect(figures).toEqual({ revenue: 100, cost: 40, grossProfit: 60, expenses: 2, netProfit: 58 });
  });

  it('resta el margen de una devolución', () => {
    const figures = netProfit({
      currency: 'ARS',
      sellRate: null,
      sales: [{ amount: 1200, currency: 'ARS', cost: 800, costCurrency: 'ARS' }],
      expenses: [],
      returns: [{ amount: 1200, currency: 'ARS', cost: 800, costCurrency: 'ARS' }],
    });
    expect(figures).toEqual({ revenue: 0, cost: 0, grossProfit: 0, expenses: 0, netProfit: 0 });
  });

  it('deja la cuenta en cero si no hay movimientos y no convierte sin cotización', () => {
    expect(netProfit({ currency: 'ARS', sellRate: null, sales: [], expenses: [] })).toEqual({
      revenue: 0, cost: 0, grossProfit: 0, expenses: 0, netProfit: 0,
    });
    expect(netProfit({
      currency: 'ARS',
      sellRate: null,
      sales: [{ amount: 100, currency: 'USD', cost: 0, costCurrency: 'ARS' }],
      expenses: [],
    })).toBeNull();
  });
});
