import type { Product, Sale } from '../types';
import { isVoidRow, saleQuantity } from './format';
import { projectAmount, type MoneyCurrency } from './money';
import type { ReturnCaseView } from '../services/returns-api';
import { returnReversal } from './net-profit';
import { compensatedReturns } from './sale-returns';

export function summarizeSaleProfit(
  sales: readonly Sale[],
  inventory: readonly Pick<Product, 'id' | 'cost' | 'currency'>[],
  active: MoneyCurrency,
  sellRate: number | null,
  returns: readonly ReturnCaseView[] = [],
) {
  const items = new Map(inventory.map(item => [item.id, item]));
  let grossProfit = 0;
  let marginRevenue = 0;
  let costedSales = 0;
  let costedReturns = 0;
  let salesWithoutCost = 0;
  let blocked = false;
  let totalRevenue = 0;
  let revenueBlocked = false;

  for (const sale of sales) {
    if (isVoidRow(sale)) continue;
    const total = projectAmount(sale.amount, sale.amountCurrency, active, sellRate);
    if (total.blocked) revenueBlocked = true;
    else totalRevenue += total.value;
    const item = items.get(sale.productId);
    if (!item || !Number.isFinite(item.cost) || !(item.cost > 0)) {
      salesWithoutCost += 1;
      continue;
    }
    costedSales += 1;
    const revenue = projectAmount(sale.amount, sale.amountCurrency, active, sellRate);
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
    const cost = projectAmount(reversal.cost, reversal.costCurrency, active, sellRate);
    if (amount.blocked) { revenueBlocked = true; if (row.itemCost > 0) blocked = true; continue; }
    if (row.itemCost > 0 && cost.blocked) { blocked = true; }
    // A missing cost quote must not hide revenue that can be converted.
    totalRevenue -= amount.value;
    if (row.itemCost > 0) {
      costedReturns += 1;
      grossProfit -= amount.value - cost.value;
      marginRevenue -= amount.value;
    }
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
