import { combineAmounts, type MoneyCurrency } from "../periodic-reports/report-math.js";

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

/**
 * Ganancia bruta = precio de la venta − costo del equipo, igual que el margen de Ventas.
 * Cada importe se proyecta con la cotización de venta, la misma cuenta de Reportes.
 * La ganancia neta resta los gastos del mismo período y el margen de los cambios y reintegros resueltos en ese período. El valor tomado de un canje no entra.
 */
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
