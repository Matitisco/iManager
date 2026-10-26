import type { Client, RepairOrder, Sale } from '../types';
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

export function formatClientSpending(parts: StoredAmount[], money: MoneyApi, preserveCurrency = false) {
  if (parts.length === 0) return money.showActive(0);
  if (parts.length === 1 && !preserveCurrency) return money.show(parts[0].amount, parts[0].currency, parts[0].amount % 1 ? 2 : 0);
  // Mixed currencies remain explicit even when an exchange rate is available.
  return parts.map(part => formatMoney(part.amount, recordCurrency(part.currency, money.active), part.amount % 1 ? 2 : 0)).join(' + ');
}

/** Only explicitly imported opening history; never infer it from totalSpent. */
export function importedClientSpending(client?: Client): StoredAmount[] {
  if (client?.importedSpent == null || !['ARS', 'USD'].includes(client.importedSpentCurrency ?? '')) return [];
  return [{ amount: client.importedSpent, currency: client.importedSpentCurrency! }];
}

export function combinedClientSpending(parts: StoredAmount[], client?: Client): StoredAmount[] {
  const totals = new Map<string | null, number>();
  for (const part of [...parts, ...importedClientSpending(client)]) {
    const key = part.currency ?? null;
    totals.set(key, (totals.get(key) ?? 0) + part.amount);
  }
  return [...totals].sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')).map(([currency, amount]) => ({ currency, amount }));
}
