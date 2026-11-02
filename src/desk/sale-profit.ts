import type { Product, Sale } from '../types';
import { isVoidRow, saleQuantity } from './format';
import { projectAmount, type MoneyCurrency } from './money';
import type { ReturnCaseView } from '../services/returns-api';
import { compensatedReturns } from './return-financials';
import { returnReversal } from './net-profit';

export function summarizeSaleProfit(
  sales: readonly Sale[],
  inventory: readonly Pick<Product, 'id' | 'cost' | 'currency'>[],
  active: MoneyCurrency,
  sellRate: number | null,
  returns: readonly ReturnCaseView[] = [],
) {
  const items = new Map(inventory.map(item => [item.id, item]));
  let totalRevenue = 0;
  let revenueBlocked = false;
  let grossProfit = 0;
  let marginRevenue = 0;
  let costedSales = 0;
  let costedReturns = 0;
  let salesWithoutCost = 0;
  let blocked = false;

  for (const sale of sales) {
    if (isVoidRow(sale)) continue;
    const revenue = projectAmount(sale.amount, sale.amountCurrency, active, sellRate);
    totalRevenue += revenue.value;
    revenueBlocked ||= revenue.blocked;
    const item = items.get(sale.productId);
    if (!item || !Number.isFinite(item.cost) || !(item.cost > 0)) {
      salesWithoutCost += 1;
      continue;
    }
    costedSales += 1;
    // Match reports: convert/round the unit cost BEFORE multiplying by quantity.
    const unitCost = projectAmount(item.cost, item.currency, active, sellRate);
    if (revenue.blocked || unitCost.blocked) {
      blocked = true;
      continue;
    }
    marginRevenue += revenue.value;
    grossProfit += revenue.value - unitCost.value * saleQuantity(sale);
  }

  for (const row of compensatedReturns(returns)) {
    const reversal = returnReversal(row);
    const amount = projectAmount(reversal.amount, reversal.currency, active, sellRate);
    totalRevenue -= amount.value;
    revenueBlocked ||= amount.blocked;
    if (!Number.isFinite(row.itemCost) || !(row.itemCost > 0)) continue;
    const cost = projectAmount(reversal.cost, reversal.costCurrency, active, sellRate);
    blocked ||= amount.blocked || cost.blocked;
    grossProfit -= amount.value - cost.value;
    marginRevenue -= amount.value;
    costedReturns += 1;
  }

  return {
    revenue: revenueBlocked ? null : totalRevenue,
    grossProfit: blocked ? null : grossProfit,
    marginRevenue: blocked ? null : marginRevenue,
    marginPct: blocked ? null : marginRevenue > 0 ? Math.round(grossProfit / marginRevenue * 100) : 0,
    costedSales,
    costedReturns,
    salesWithoutCost,
  };
}
