import { combineAmounts, type MoneyCurrency } from './money';

export interface ProfitSale {
  amount: number;
  currency?: string | null;
  cost: number;
  costCurrency?: string | null;
}

export interface ProfitExpense {
  amount: number;
  currency?: string | null;
}

export interface NetProfitFigures {
  revenue: number;
  cost: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

/** Misma cuenta que el backend: precio − costo, proyectado con el dólar venta, menos gastos y menos el margen devuelto. */
export function netProfit(input: {
  currency: MoneyCurrency;
  sellRate: number | null;
  sales: ProfitSale[];
  expenses: ProfitExpense[];
  returns?: ProfitSale[];
}): NetProfitFigures | null {
  const salesRevenue = combineAmounts(
    input.sales.map((sale) => ({ amount: sale.amount, currency: sale.currency })),
    input.currency,
    input.sellRate,
  );
  const salesCost = combineAmounts(
    input.sales.map((sale) => ({ amount: sale.cost, currency: sale.costCurrency })),
    input.currency,
    input.sellRate,
  );
  const returnedRevenue = combineAmounts(
    (input.returns ?? []).map((row) => ({ amount: row.amount, currency: row.currency })),
    input.currency,
    input.sellRate,
  );
  const returnedCost = combineAmounts(
    (input.returns ?? []).map((row) => ({ amount: row.cost, currency: row.costCurrency })),
    input.currency,
    input.sellRate,
  );
  const expenses = combineAmounts(input.expenses, input.currency, input.sellRate);
  if (salesRevenue == null || salesCost == null || returnedRevenue == null || returnedCost == null || expenses == null) return null;
  const revenue = salesRevenue - returnedRevenue;
  const cost = salesCost - returnedCost;
  const grossProfit = revenue - cost;
  return { revenue, cost, grossProfit, expenses, netProfit: grossProfit - expenses };
}

export function returnReversal(row: { moneyAmount: number; moneyCurrency?: string | null; saleAmount: number; itemCost: number; itemCurrency?: string | null }): ProfitSale {
  const base = row.saleAmount > 0 ? row.saleAmount : row.moneyAmount;
  const ratio = base > 0 ? Math.min(1, row.moneyAmount / base) : 0;
  return {
    amount: row.moneyAmount,
    currency: row.moneyCurrency,
    cost: Math.round(row.itemCost * ratio * 100) / 100,
    costCurrency: row.itemCurrency ?? row.moneyCurrency,
  };
}
