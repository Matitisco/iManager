import type { RepairOrder, Sale } from '../types';
import { clientPurchases, purchaseTotals } from './client-purchases';
import type { MoneyApi } from './exchange';
import { formatMoney } from './format';
import { recordCurrency, type MoneyCurrency, type StoredAmount } from './money';

/** Same purchase definition as the detail, grouped once for the client list. */
export function clientSpendingById(sales: Sale[], repairs: RepairOrder[], active: MoneyCurrency) {
  const groups = new Map<string, { sales: Sale[]; repairs: RepairOrder[] }>();
  const group = (id: string) => {
    let rows = groups.get(id);
    if (!rows) { rows = { sales: [], repairs: [] }; groups.set(id, rows); }
    return rows;
  };
  for (const sale of sales) group(sale.clientId).sales.push(sale);
  for (const repair of repairs) if (repair.clientId) group(repair.clientId).repairs.push(repair);
  return new Map([...groups].map(([clientId, rows]) => [clientId, purchaseTotals(clientPurchases({
    clientId, ...rows, tradeIns: [], inventory: [], sellers: [],
  }), active).spent]));
}

export function formatClientSpending(parts: StoredAmount[], money: MoneyApi) {
  if (parts.length === 0) return money.showActive(0);
  if (parts.length === 1) return money.show(parts[0].amount, parts[0].currency);
  // Mixed currencies remain explicit even when an exchange rate is available.
  return parts.map(part => formatMoney(part.amount, recordCurrency(part.currency, money.active))).join(' + ');
}
