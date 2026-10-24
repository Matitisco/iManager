import { currentBlueRate } from "../../lib/blue-rate.js";
import { prisma } from "../../plugins/prisma.js";
import { calendarDay } from "../periodic-reports/schedule.js";
import type { MoneyCurrency } from "../periodic-reports/report-math.js";
import { returnReversal } from "../returns/returns-math.js";
import { netProfit } from "./net-profit.js";

const ZONE = "America/Argentina/Buenos_Aires";

export async function reportSellRate(store: { exchangeMode: string; exchangeSource: string; manualSell: { toString(): string } | null }) {
  if (store.exchangeMode === "manual") {
    const rate = Number(store.manualSell ?? 0);
    return rate > 0 ? rate : null;
  }
  try {
    if (store.exchangeSource !== "oficial" && store.exchangeSource !== "mep") return await currentBlueRate();
    const source = store.exchangeSource === "mep" ? "bolsa" : "oficial";
    const response = await fetch(`https://dolarapi.com/v1/dolares/${source}`, { signal: AbortSignal.timeout(8000) });
    const body = await response.json() as { venta?: unknown };
    const rate = Number(body.venta);
    return response.ok && Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export async function getNetProfit(storeId: string, from: string, to: string) {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    select: { currency: true, timezone: true, exchangeMode: true, exchangeSource: true, manualSell: true },
  });
  const zone = store.timezone || ZONE;
  const currency: MoneyCurrency = store.currency === "USD" ? "USD" : "ARS";
  const rate = await reportSellRate(store);
  const sales = await prisma.sale.findMany({
    where: { storeId, voidedAt: null, status: { not: "CANCELADA" } },
    select: {
      amount: true,
      amountCurrency: true,
      dateLabel: true,
      soldAt: true,
      inventoryItem: { select: { cost: true, currency: true } },
    },
  });
  const expenses = await prisma.expense.findMany({
    where: { storeId, deletedAt: null },
    select: { amount: true, currency: true, spentAt: true },
  });
  const claims = await prisma.returnCase.findMany({
    where: { storeId, deletedAt: null, status: { not: "ANULADO" }, resolution: { in: ["CAMBIO", "REINTEGRO"] }, resolvedAt: { not: null } },
    select: {
      resolvedAt: true,
      moneyAmount: true,
      moneyCurrency: true,
      sale: { select: { amount: true, inventoryItem: { select: { cost: true, currency: true } } } },
    },
  });
  const inRange = (day: string) => day >= from && day <= to;
  const figures = netProfit({
    currency,
    sellRate: rate,
    sales: sales.flatMap((sale) => {
      const day = sale.dateLabel?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
        ? sale.dateLabel.slice(0, 10)
        : calendarDay(sale.soldAt, zone);
      if (!inRange(day)) return [];
      return [{
        amount: Number(sale.amount),
        currency: sale.amountCurrency ?? currency,
        cost: Number(sale.inventoryItem?.cost ?? 0),
        costCurrency: sale.inventoryItem?.currency ?? currency,
      }];
    }),
    expenses: expenses.flatMap((expense) => {
      const day = calendarDay(expense.spentAt, zone);
      if (!inRange(day)) return [];
      return [{ amount: Number(expense.amount), currency: expense.currency }];
    }),
    returns: claims.flatMap((claim) => {
      if (!claim.resolvedAt || !inRange(calendarDay(claim.resolvedAt, zone))) return [];
      const reversal = returnReversal({
        saleAmount: Number(claim.sale?.amount ?? claim.moneyAmount),
        moneyAmount: Number(claim.moneyAmount),
        itemCost: Number(claim.sale?.inventoryItem?.cost ?? 0),
      });
      return [{
        amount: reversal.amount,
        currency: claim.moneyCurrency ?? currency,
        cost: reversal.cost,
        costCurrency: claim.sale?.inventoryItem?.currency ?? claim.moneyCurrency ?? currency,
      }];
    }),
  });
  return {
    currency,
    sellRate: rate,
    blocked: figures == null,
    revenue: figures?.revenue ?? null,
    cost: figures?.cost ?? null,
    grossProfit: figures?.grossProfit ?? null,
    expenses: figures?.expenses ?? null,
    netProfit: figures?.netProfit ?? null,
  };
}
