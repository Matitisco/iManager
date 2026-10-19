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

/** Misma cuenta que el backend: precio − costo, proyectado con el dólar venta, menos gastos. */
export function netProfit(input: {
  currency: MoneyCurrency;
  sellRate: number | null;
  sales: ProfitSale[];
  expenses: ProfitExpense[];
}): NetProfitFigures | null {
  const revenue = combineAmounts(
    input.sales.map((sale) => ({ amount: sale.amount, currency: sale.currency })),
    input.currency,
    input.sellRate,
  );
  const cost = combineAmounts(
    input.sales.map((sale) => ({ amount: sale.cost, currency: sale.costCurrency })),
    input.currency,
    input.sellRate,
  );
  const expenses = combineAmounts(input.expenses, input.currency, input.sellRate);
  if (revenue == null || cost == null || expenses == null) return null;
  const grossProfit = revenue - cost;
  return { revenue, cost, grossProfit, expenses, netProfit: grossProfit - expenses };
}
