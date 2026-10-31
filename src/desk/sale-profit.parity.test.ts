import { describe, expect, it, vi } from 'vitest';
import type { Sale } from '../types';
import { summarizeSaleProfit } from './sale-profit';

const mocks = vi.hoisted(() => ({
  sales: vi.fn(),
  store: vi.fn(),
}));

vi.mock('../../backend/src/plugins/prisma.js', () => ({
  prisma: {
    store: { findUniqueOrThrow: mocks.store },
    sale: { findMany: mocks.sales },
    tradeIn: { findMany: vi.fn(async () => []) },
    client: {
      count: vi.fn(async () => 0),
      aggregate: vi.fn(async () => ({ _sum: { pendingBalance: 0 } })),
    },
    inventoryItem: {
      aggregate: vi.fn(async () => ({ _sum: { cantidad: 0 } })),
      findMany: vi.fn(async () => []),
    },
    returnCase: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock('../../backend/src/modules/reports/net-profit.service.js', () => ({
  reportSellRate: vi.fn(async () => 1000),
}));

// Execute real reports mapping + summarizeCompleted; only IO is mocked, no DB.
import { getReportsOverview } from '../../backend/src/modules/reports/reports.service';

describe('Ventas / reports profit parity', () => {
  it.each(['ARS', 'USD'] as const)('matches the real reports service in %s with five units and mixed currencies', async active => {
    const inventory = [
      { id: 'usd', model: 'A', cost: 100, currency: 'USD' },
      // Non-integer converted cost detects multiplying before unit rounding.
      { id: 'ars', model: 'B', cost: 120499, currency: 'ARS' },
      { id: 'unknown', model: 'C', cost: 0, currency: 'USD' },
    ];
    const common = { date: '2026-10-01', clientId: '', cantidad: 5, status: 'COMPLETADA', paymentMethod: 'EFECTIVO' };
    const sales: Sale[] = [
      { ...common, id: 'a', productId: 'usd', amount: 800000, amountCurrency: 'ARS' },
      { ...common, id: 'b', productId: 'ars', amount: 1000, amountCurrency: 'USD' },
      { ...common, id: 'c', productId: 'unknown', amount: 900, amountCurrency: 'USD' },
      { ...common, id: 'd', productId: '', amount: 900, amountCurrency: 'USD' },
    ];
    mocks.store.mockResolvedValue({ currency: active });
    mocks.sales.mockResolvedValue(sales.map(sale => ({
      ...sale,
      soldAt: new Date('2026-10-01T12:00:00Z'),
      inventoryItem: inventory.find(item => item.id === sale.productId) ?? null,
    })));
    const reports = await getReportsOverview('synthetic', { rangeKey: 'all_time', startDate: null, endDate: null });
    const front = summarizeSaleProfit(sales, inventory, active, 1000);
    expect(front.grossProfit).toBe(active === 'USD' ? 700 : 697505);
    expect(front.grossProfit).toBe(reports.summary.grossProfit);
    expect(front.salesWithoutCost).toBe(reports.summary.salesWithoutCost);
    expect(front.marginPct).toBe(Math.round(reports.summary.marginRate));
  });
});
