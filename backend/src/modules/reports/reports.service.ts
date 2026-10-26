import { reportSellRate } from "./net-profit.service.js";
import { projectAmount, type MoneyCurrency } from "../periodic-reports/report-math.js";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { returnCompensatedAt, returnRecognitionSelect } from "../returns/return-recognition.js";

export type ReportsRangeKey =
  | "this_month"
  | "last_90_days"
  | "this_year"
  | "all_time"
  | "custom";

export interface ReportsOverviewInput {
  rangeKey: ReportsRangeKey;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ReportsSummary {
  revenue: number;
  grossProfit: number;
  unitsSold: number;
  averageTicket: number;
  pendingSales: number;
  pendingAmount: number;
  marginRate: number;
  approvedTradeIns: number;
  returnsCount: number;
  returnsAmount: number;
}

export interface ReportsSeriesPoint {
  label: string;
  start: string;
  revenue: number;
  unitsSold: number;
}

export interface ReportsTopProduct {
  product: string;
  unitsSold: number;
  revenue: number;
  share: number;
}

export interface ReportsPaymentMethodBreakdown {
  label: string;
  revenue: number;
  count: number;
  share: number;
}

export interface ReportsAgingBucket {
  label: string;
  count: number;
  costValue: number;
}

export interface ReportsInventorySnapshot {
  totalItems: number;
  availableItems: number;
  soldItems: number;
  inReviewItems: number;
  valuation: {
    costValue: number;
    retailValue: number;
  };
  aging: ReportsAgingBucket[];
  series: ReportsSeriesPoint[];
}

export interface ReportsComparison {
  available: boolean;
  revenue: number;
  grossProfit: number;
  unitsSold: number;
  averageTicket: number;
  revenueChange: number | null;
  grossProfitChange: number | null;
  unitsChange: number | null;
  averageTicketChange: number | null;
}

export interface ReportsCategoryBreakdown {
  category: string;
  unitsSold: number;
  revenue: number;
  share: number;
}

export interface ReportsTopClient {
  client: string;
  purchases: number;
  revenue: number;
}

export interface ReportsClientSnapshot {
  totalClients: number;
  activeClients: number;
  pendingBalance: number;
}

export interface ReportsTradeInSnapshot {
  totalInRange: number;
  approvedInRange: number;
  openInRange: number;
  cashGenerated: number;
  openCash: number;
  otherCash: number;
  series: ReportsSeriesPoint[];
}

export interface ReportsOverviewResponse {
  currency: MoneyCurrency;
  filters: {
    rangeKey: ReportsRangeKey;
    startDate: string | null;
    endDate: string | null;
  };
  summary: ReportsSummary;
  comparison: ReportsComparison;
  salesSeries: ReportsSeriesPoint[];
  topProducts: ReportsTopProduct[];
  categories: ReportsCategoryBreakdown[];
  topClients: ReportsTopClient[];
  paymentMethods: ReportsPaymentMethodBreakdown[];
  inventory: ReportsInventorySnapshot;
  clients: ReportsClientSnapshot;
  tradeIns: ReportsTradeInSnapshot;
}

class ReportsError extends DomainError {}

const APPROVED_TRADE_IN_STATUSES = new Set(["APROBADO", "LISTO"]);
const OPEN_TRADE_IN_STATUSES = new Set(["PENDIENTE", "EN REVISIÓN", "PERITAJE TÉC."]);
const AGING_BUCKETS = ["0-14 días", "15-30 días", "31-60 días", "Más de 60 días"] as const;
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFERENCIA: "Transferencia",
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  "CANJE / PAGO": "Canje / pago",
  "T. Crédito": "T. Crédito",
};

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDateRangeWhere(
  field: "soldAt" | "tradeAt" | "createdAt",
  startDate: Date | null,
  endDate: Date | null
) {
  if (!startDate && !endDate) {
    return {};
  }

  return {
    [field]: {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    },
  };
}

// Reports use Argentine business days, independently of the server timezone.
function argentinaDay(value: Date) {
  return new Date(value.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildProductLabel(input?: {
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
} | null) {
  const label = [input?.model, input?.capacity, input?.color]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return label || "Producto sin referencia";
}

type CompletedSale = {
  amount: number;
  paymentMethod: string;
  soldAt: Date;
  clientId: string | null;
  product: string;
  category: string;
  clientName: string;
  cost: number;
};

export function formatPaymentMethodLabel(value: string) {
  const trimmed = value.trim();
  return PAYMENT_METHOD_LABELS[trimmed] ?? (trimmed || "Sin método");
}

export function changePercent(current: number, previous: number) {
  // Less than one currency unit is not a useful denominator. This also avoids
  // zero/zero implying a measured variation when there is no comparison base.
  if (!Number.isFinite(current) || !Number.isFinite(previous) || Math.abs(previous) < 1) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function resolvePreviousWindow(input: ReportsOverviewInput) {
  if (input.rangeKey === "all_time" || !input.startDate || !input.endDate) {
    return null;
  }

  const duration = input.endDate.getTime() - input.startDate.getTime();
  if (duration < 0) {
    return null;
  }

  const endDate = new Date(input.startDate.getTime() - 1);
  const startDate = new Date(endDate.getTime() - duration);
  return { startDate, endDate };
}

export function buildInventoryAging(
  items: Array<{ createdAt: Date; cost: number }>,
  now = new Date()
) {
  const buckets = new Map(
    AGING_BUCKETS.map((label) => [label, { label, count: 0, costValue: 0 }])
  );

  for (const item of items) {
    const elapsed = now.getTime() - item.createdAt.getTime();
    const days = Math.max(0, Math.floor(elapsed / (1000 * 60 * 60 * 24)));
    const label =
      days <= 14
        ? "0-14 días"
        : days <= 30
          ? "15-30 días"
          : days <= 60
            ? "31-60 días"
            : "Más de 60 días";
    const bucket = buckets.get(label);
    if (!bucket) {
      continue;
    }

    bucket.count += 1;
    bucket.costValue += item.cost;
  }

  return AGING_BUCKETS.map((label) => {
    const bucket = buckets.get(label);
    return bucket ?? { label, count: 0, costValue: 0 };
  });
}

function summarizeCompleted(sales: Array<{ amount: number; cost: number }>) {
  const revenue = sales.reduce((accumulator, sale) => accumulator + sale.amount, 0);
  const grossProfit = sales.reduce(
    (accumulator, sale) => accumulator + (sale.amount - sale.cost),
    0
  );
  const unitsSold = sales.length;
  const averageTicket = unitsSold > 0 ? revenue / unitsSold : 0;

  return { revenue, grossProfit, unitsSold, averageTicket };
}

type ReportsQueryInput = {
  rangeKey: ReportsRangeKey;
  startDate?: string;
  endDate?: string;
};

function buildSalesSeries(
  sales: CompletedSale[],
  startDate: Date | null,
  endDate: Date | null
): ReportsSeriesPoint[] {
  if (!sales.length && !startDate && !endDate) return [];
  const sorted = [...sales].sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());
  const first = argentinaDay(startDate ?? sorted[0]?.soldAt ?? new Date());
  const last = argentinaDay(endDate ?? sorted.at(-1)?.soldAt ?? new Date());
  const daily = !!startDate && !!endDate && endDate.getTime() - startDate.getTime() <= 84 * 86400000;
  const keyOf = (day: string) => daily ? day : `${day.slice(0, 7)}-01`;
  const buckets = new Map<string, ReportsSeriesPoint>();
  const cursor = new Date(`${keyOf(first)}T12:00:00Z`);
  const lastKey = keyOf(last);
  while (cursor.toISOString().slice(0, 10) <= lastKey) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.set(key, { label: key.split('-').reverse().join('/'), start: key, revenue: 0, unitsSold: 0 });
    if (daily) cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const sale of sales) {
    const bucket = buckets.get(keyOf(argentinaDay(sale.soldAt)));
    if (bucket) { bucket.revenue += sale.amount; bucket.unitsSold += 1; }
  }
  return [...buckets.values()];
}

function buildActivitySeries(
  entries: Array<{ at: Date; amount: number }>,
  startDate: Date | null,
  endDate: Date | null
) {
  return buildSalesSeries(
    entries.map((entry) => ({
      amount: entry.amount,
      paymentMethod: "",
      soldAt: entry.at,
      clientId: null,
      product: "",
      category: "",
      clientName: "",
      cost: 0,
    })),
    startDate,
    endDate
  );
}

export async function getReportsOverview(
  storeId: string,
  input: ReportsOverviewInput
): Promise<ReportsOverviewResponse> {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { currency: true, exchangeMode: true, exchangeSource: true, manualSell: true } });
  const currency: MoneyCurrency = store.currency === 'USD' ? 'USD' : 'ARS';
  const salesWhere = {
    storeId,
    voidedAt: null,
    ...buildDateRangeWhere("soldAt", input.startDate, input.endDate),
  };
  const tradeInsWhere = {
    storeId,
    voidedAt: null,
    ...buildDateRangeWhere("tradeAt", input.startDate, input.endDate),
  };
  const previousWindow = resolvePreviousWindow(input);
  const inventoryWhere = {
    storeId,
    archivedAt: null,
    ...buildDateRangeWhere("createdAt", input.startDate, input.endDate),
  };

  const [
    sales,
    previousSales,
    tradeIns,
    totalClients,
    pendingBalanceAggregate,
    totalItems,
    availableItems,
    soldItems,
    inReviewItems,
    inventoryValuation,
    availableStock,
    inboundStock,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: salesWhere,
      select: {
        amount: true,
        amountCurrency: true,
        paymentMethod: true,
        status: true,
        soldAt: true,
        clientId: true,
        category: {
          select: { name: true },
        },
        client: {
          select: { name: true },
        },
        inventoryItem: {
          select: {
            model: true,
            capacity: true,
            color: true,
            cost: true,
            currency: true,
          },
        },
      },
      orderBy: { soldAt: "asc" },
    }),
    previousWindow
      ? prisma.sale.findMany({
          where: {
            storeId,
            voidedAt: null,
            status: "COMPLETADA",
            soldAt: {
              gte: previousWindow.startDate,
              lte: previousWindow.endDate,
            },
          },
          select: {
            amount: true,
            amountCurrency: true,
            inventoryItem: {
              select: { cost: true, currency: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.tradeIn.findMany({
      where: tradeInsWhere,
      select: {
        differencePaid: true,
        status: true,
        tradeAt: true,
      },
    }),
    prisma.client.count({
      where: { storeId },
    }),
    prisma.client.aggregate({
      where: { storeId },
      _sum: { pendingBalance: true },
    }),
    prisma.inventoryItem.count({
      where: inventoryWhere,
    }),
    prisma.inventoryItem.count({
      where: { ...inventoryWhere, status: "DISPONIBLE" },
    }),
    prisma.inventoryItem.count({
      where: { ...inventoryWhere, status: "VENDIDO" },
    }),
    prisma.inventoryItem.count({
      where: { ...inventoryWhere, status: "EN_REVISION" },
    }),
    prisma.inventoryItem.aggregate({
      where: { ...inventoryWhere, status: "DISPONIBLE" },
      _sum: {
        cost: true,
        price: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where: { ...inventoryWhere, status: "DISPONIBLE" },
      select: {
        createdAt: true,
        cost: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where: inventoryWhere,
      select: {
        createdAt: true,
        cost: true,
      },
    }),
  ]);

  const needsConversion = [...sales.filter(sale => sale.status === 'COMPLETADA' || sale.status === 'PENDIENTE'), ...previousSales].some(sale =>
    (sale.amountCurrency != null && sale.amountCurrency !== currency) ||
    (sale.inventoryItem?.currency != null && sale.inventoryItem.currency !== currency));
  const rate = needsConversion ? await reportSellRate(store) : null;
  const convert = (value: unknown, storedCurrency?: string | null) => {
    const projected = projectAmount(toNumber(value), storedCurrency, currency, rate);
    if (projected.blocked) throw new ReportsError('No se pudo convertir el reporte. Revisá la cotización del local.', 503);
    return projected.value;
  };

  const completedSales: CompletedSale[] = sales
    .filter((sale) => sale.status === "COMPLETADA")
    .map((sale) => ({
      amount: convert(sale.amount, sale.amountCurrency),
      paymentMethod: sale.paymentMethod,
      soldAt: sale.soldAt,
      clientId: sale.clientId,
      product: buildProductLabel(sale.inventoryItem),
      category: sale.category?.name?.trim() || "Sin categoría",
      clientName: sale.client?.name?.trim() || "Sin cliente",
      cost: convert(sale.inventoryItem?.cost, sale.inventoryItem?.currency),
    }));

  const activeTradeIns = tradeIns.filter((tradeIn) => tradeIn.status !== "CANCELADO");
  const pendingSaleRows = sales.filter((sale) => sale.status === "PENDIENTE");
  const pendingSales = pendingSaleRows.length;
  const pendingAmount = pendingSaleRows.reduce(
    (accumulator, sale) => accumulator + convert(sale.amount, sale.amountCurrency),
    0
  );
  const currentMetrics = summarizeCompleted(completedSales);
  const previousMetrics = summarizeCompleted(
    previousSales.map((sale) => ({
      amount: convert(sale.amount, sale.amountCurrency),
      cost: convert(sale.inventoryItem?.cost, sale.inventoryItem?.currency),
    }))
  );
  const { revenue, grossProfit, unitsSold, averageTicket } = currentMetrics;
  const marginRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const approvedTradeIns = activeTradeIns.filter((tradeIn) => APPROVED_TRADE_IN_STATUSES.has(tradeIn.status)).length;
  const activeClients = new Set(
    completedSales
      .map((sale) => sale.clientId)
      .filter((clientId): clientId is string => Boolean(clientId))
  ).size;

  const topProductsMap = new Map<string, { unitsSold: number; revenue: number }>();
  for (const sale of completedSales) {
    const current = topProductsMap.get(sale.product) ?? { unitsSold: 0, revenue: 0 };
    current.unitsSold += 1;
    current.revenue += sale.amount;
    topProductsMap.set(sale.product, current);
  }

  const topProducts = Array.from(topProductsMap.entries())
    .map(([product, current]) => ({
      product,
      unitsSold: current.unitsSold,
      revenue: current.revenue,
      share: unitsSold > 0 ? (current.unitsSold / unitsSold) * 100 : 0,
    }))
    .sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue)
    .slice(0, 6);

  const paymentMethodMap = new Map<string, { revenue: number; count: number }>();
  for (const sale of completedSales) {
    const current = paymentMethodMap.get(sale.paymentMethod) ?? { revenue: 0, count: 0 };
    current.revenue += sale.amount;
    current.count += 1;
    paymentMethodMap.set(sale.paymentMethod, current);
  }

  const paymentMethods = Array.from(paymentMethodMap.entries())
    .map(([label, current]) => ({
      label: formatPaymentMethodLabel(label),
      revenue: current.revenue,
      count: current.count,
      share: revenue > 0 ? (current.revenue / revenue) * 100 : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const categoryMap = new Map<string, { unitsSold: number; revenue: number }>();
  for (const sale of completedSales) {
    const current = categoryMap.get(sale.category) ?? { unitsSold: 0, revenue: 0 };
    current.unitsSold += 1;
    current.revenue += sale.amount;
    categoryMap.set(sale.category, current);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([category, current]) => ({
      category,
      unitsSold: current.unitsSold,
      revenue: current.revenue,
      share: revenue > 0 ? (current.revenue / revenue) * 100 : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue || right.unitsSold - left.unitsSold);

  const clientMap = new Map<string, { purchases: number; revenue: number }>();
  for (const sale of completedSales) {
    const current = clientMap.get(sale.clientName) ?? { purchases: 0, revenue: 0 };
    current.purchases += 1;
    current.revenue += sale.amount;
    clientMap.set(sale.clientName, current);
  }

  const topClients = Array.from(clientMap.entries())
    .map(([client, current]) => ({
      client,
      purchases: current.purchases,
      revenue: current.revenue,
    }))
    .sort((left, right) => right.revenue - left.revenue || right.purchases - left.purchases)
    .slice(0, 5);

  const approvedTradeInRows = activeTradeIns.filter((tradeIn) => APPROVED_TRADE_IN_STATUSES.has(tradeIn.status));
  const openTradeInRows = activeTradeIns.filter((tradeIn) => OPEN_TRADE_IN_STATUSES.has(tradeIn.status));
  const otherTradeInRows = activeTradeIns.filter(
    (tradeIn) =>
      !APPROVED_TRADE_IN_STATUSES.has(tradeIn.status) && !OPEN_TRADE_IN_STATUSES.has(tradeIn.status)
  );
  const sumDifference = (rows: typeof tradeIns) =>
    rows.reduce((accumulator, tradeIn) => accumulator + toNumber(tradeIn.differencePaid), 0);
  const tradeInCash = sumDifference(approvedTradeInRows);
  const openTradeInCash = sumDifference(openTradeInRows);
  const otherTradeInCash = sumDifference(otherTradeInRows);
  const openTradeIns = openTradeInRows.length;
  const commercialReturns = await prisma.returnCase.findMany({
    where: {
      storeId,
      deletedAt: null,
      status: { not: "ANULADO" }, resolution: { in: ["CAMBIO", "REINTEGRO"] },
    },
    select: { ...returnRecognitionSelect, moneyAmount: true },
  });
  const compensatedReturns = commercialReturns.filter(row => {
    const issuedAt = returnCompensatedAt(row);
    return issuedAt && (!input.startDate || issuedAt >= input.startDate) && (!input.endDate || issuedAt <= input.endDate);
  });

  return {
    currency,
    filters: {
      rangeKey: input.rangeKey,
      startDate: input.startDate?.toISOString() ?? null,
      endDate: input.endDate?.toISOString() ?? null,
    },
    summary: {
      revenue,
      grossProfit,
      unitsSold,
      averageTicket,
      pendingSales,
      pendingAmount,
      marginRate,
      approvedTradeIns,
      returnsCount: compensatedReturns.length,
      returnsAmount: compensatedReturns.reduce((total, row) => total + toNumber(row.moneyAmount), 0),
    },
    comparison: {
      available: previousWindow !== null,
      revenue: previousMetrics.revenue,
      grossProfit: previousMetrics.grossProfit,
      unitsSold: previousMetrics.unitsSold,
      averageTicket: previousMetrics.averageTicket,
      revenueChange: previousWindow ? changePercent(revenue, previousMetrics.revenue) : null,
      grossProfitChange: previousWindow
        ? changePercent(grossProfit, previousMetrics.grossProfit)
        : null,
      unitsChange: previousWindow ? changePercent(unitsSold, previousMetrics.unitsSold) : null,
      averageTicketChange: previousWindow
        ? changePercent(averageTicket, previousMetrics.averageTicket)
        : null,
    },
    salesSeries: buildSalesSeries(completedSales, input.startDate, input.endDate),
    topProducts,
    categories,
    topClients,
    paymentMethods,
    inventory: {
      totalItems,
      availableItems,
      soldItems,
      inReviewItems,
      valuation: {
        costValue: toNumber(inventoryValuation._sum.cost),
        retailValue: toNumber(inventoryValuation._sum.price),
      },
      aging: buildInventoryAging(
        availableStock.map((item) => ({
          createdAt: item.createdAt,
          cost: toNumber(item.cost),
        }))
      ),
      series: buildActivitySeries(
        inboundStock.map((item) => ({
          at: item.createdAt,
          amount: toNumber(item.cost),
        })),
        input.startDate,
        input.endDate
      ),
    },
    clients: {
      totalClients,
      activeClients,
      pendingBalance: toNumber(pendingBalanceAggregate._sum.pendingBalance),
    },
    tradeIns: {
      totalInRange: activeTradeIns.length,
      approvedInRange: approvedTradeIns,
      openInRange: openTradeIns,
      cashGenerated: tradeInCash,
      openCash: openTradeInCash,
      otherCash: otherTradeInCash,
      series: buildActivitySeries(
        activeTradeIns.map((tradeIn) => ({
          at: tradeIn.tradeAt,
          amount: toNumber(tradeIn.differencePaid),
        })),
        input.startDate,
        input.endDate
      ),
    },
  };
}

export function parseReportsDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ReportsError("Invalid report date", 400);
  }

  return parsed;
}

export function normalizeReportsOverviewInput(input: ReportsQueryInput): ReportsOverviewInput {
  // Total never carries boundaries, even if a caller supplies stale dates.
  if (input.rangeKey === "all_time") return { rangeKey: input.rangeKey, startDate: null, endDate: null };
  const startDate = parseReportsDate(input.startDate);
  const endDate = parseReportsDate(input.endDate);

  if (input.rangeKey === "custom" && (!startDate || !endDate)) {
    throw new ReportsError("Custom report range requires startDate and endDate", 400);
  }

  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new ReportsError("Report startDate must be before endDate", 400);
  }

  return {
    rangeKey: input.rangeKey,
    startDate,
    endDate,
  };
}

