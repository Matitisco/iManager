import { describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  store: {
    findUniqueOrThrow: vi.fn(async () => ({
      currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires',
      exchangeMode: 'manual',
      exchangeSource: 'blue',
      manualSell: 1000,
    })),
  },
  sale: {
    findMany: vi.fn(async () => [
      {
        amount: 300,
        amountCurrency: 'ARS',
        dateLabel: '10/10/2026',
        soldAt: new Date('2026-10-10T12:00:00Z'),
        cantidad: 2,
        status: 'COMPLETADA',
        voidedAt: null,
        cancelledAt: null,
        inventoryItem: { cost: 60, currency: 'ARS' },
      },
      {
        amount: 400,
        amountCurrency: 'ARS',
        dateLabel: '',
        soldAt: new Date('2026-11-01T02:00:00Z'),
        cantidad: 1,
        status: 'COMPLETADA',
        voidedAt: null,
        cancelledAt: null,
        inventoryItem: { cost: 100, currency: 'ARS' },
      },
      { amount: 9999, status: 'CANCELADA', voidedAt: null, cancelledAt: null },
    ]),
  },
  expense: {
    findMany: vi.fn(async () => [
      { amount: 1, currency: 'USD', spentAt: new Date('2026-11-01T02:30:00Z') },
    ]),
  },
  returnCase: {
    findMany: vi.fn(async () => [
      {
        settlement: 'REINTEGRO',
        resolvedAt: new Date('2026-10-15T12:00:00Z'),
        creditNote: null,
        events: [],
        moneyAmount: 150,
        moneyCurrency: 'ARS',
        sale: {
          cantidad: 2,
          amount: 300,
          inventoryItem: { cost: 60, currency: 'ARS' },
        },
      },
    ]),
  },
}));
vi.mock('../../plugins/prisma.js', () => ({ prisma: db }));
vi.mock('../../lib/accounting-states.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/accounting-states.js')>()),
  storedStateFilter: async () => ({ notIn: ['CANCELADA'] }),
}));
import { getNetProfit, loadNetProfit } from '../reports/net-profit.service.js';

describe('paridad del cálculo mensual con Reportes', () => {
  it('reutiliza consultas y reglas de ventas, devoluciones y días locales sin cambiar el resultado', async () => {
    const expected = {
      revenue: 550,
      cost: 160,
      grossProfit: 390,
      expenses: 1000,
      netProfit: -610,
      currency: 'ARS',
      sellRate: 1000,
      blocked: false,
    };
    const context = await loadNetProfit('ficticia');
    expect(context.calculate('2026-10-01', '2026-10-31')).toEqual(expected);
    expect(context.calculate('2026-11-01', '2026-11-30')).toMatchObject({
      revenue: 0,
      cost: 0,
      expenses: 0,
      netProfit: 0,
    });
    expect(db.sale.findMany).toHaveBeenCalledTimes(1);
    expect(db.expense.findMany).toHaveBeenCalledTimes(1);
    expect(db.returnCase.findMany).toHaveBeenCalledTimes(1);
    expect(await getNetProfit('ficticia', '2026-10-01', '2026-10-31')).toEqual(
      expected,
    );
  });
});
