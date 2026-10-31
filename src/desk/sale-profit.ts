import type { Product, Sale } from '../types';
import { isVoidRow, saleQuantity } from './format';
import { projectAmount, type MoneyCurrency } from './money';

export function summarizeSaleProfit(
  sales: readonly Sale[],
  inventory: readonly Pick<Product, 'id' | 'cost' | 'currency'>[],
  active: MoneyCurrency,
  sellRate: number | null,
) {
  const items = new Map(inventory.map(item => [item.id, item]));
  let grossProfit = 0;
  let marginRevenue = 0;
  let costedSales = 0;
  let salesWithoutCost = 0;
  let blocked = false;

  for (const sale of sales) {
    if (isVoidRow(sale)) continue;
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

  return {
    grossProfit: blocked ? null : grossProfit,
    marginRevenue: blocked ? null : marginRevenue,
    marginPct: blocked ? null : marginRevenue > 0 ? Math.round(grossProfit / marginRevenue * 100) : 0,
    costedSales,
    salesWithoutCost,
  };
}
