import { prisma } from "../../plugins/prisma.js";

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
}

export interface ReportsOverviewResponse {
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

class ReportsError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

function buildDateRangeWhere(field: "soldAt" | "tradeAt", startDate: Date | null, endDate: Date | null) {
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

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatMonthLabel(value: Date, includeYear: boolean) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(value);
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
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

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
  const hasExplicitShortRange =
    startDate &&
    endDate &&
    endDate.getTime() - startDate.getTime() <= 1000 * 60 * 60 * 24 * 45;

  if (sales.length === 0 && !startDate && !endDate) {
    return [];
  }

  if (hasExplicitShortRange && startDate && endDate) {
    const buckets = new Map<string, ReportsSeriesPoint>();
    let cursor = startOfDay(startDate);
    const last = startOfDay(endDate);

    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      buckets.set(key, {
        label: formatDayLabel(cursor),
        start: key,
        revenue: 0,
        unitsSold: 0,
      });
      cursor = addDays(cursor, 1);
    }

    for (const sale of sales) {
      const key = startOfDay(sale.soldAt).toISOString().slice(0, 10);
      const current = buckets.get(key);
      if (!current) {
        continue;
      }

      current.revenue += sale.amount;
      current.unitsSold += 1;
    }

    return Array.from(buckets.values());
  }

  const sortedSales = [...sales].sort((left, right) => left.soldAt.getTime() - right.soldAt.getTime());
  const firstMonth = startDate
    ? startOfMonth(startDate)
    : sortedSales.length > 0
      ? startOfMonth(sortedSales[0].soldAt)
      : startOfMonth(new Date());
  const lastMonth = endDate
    ? startOfMonth(endDate)
    : sortedSales.length > 0
      ? startOfMonth(sortedSales[sortedSales.length - 1].soldAt)
      : startOfMonth(new Date());
  const includeYear =
    firstMonth.getFullYear() !== lastMonth.getFullYear() ||
    (!startDate && !endDate);
  const buckets = new Map<string, ReportsSeriesPoint>();

  let cursor = firstMonth;
  while (cursor <= lastMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      label: formatMonthLabel(cursor, includeYear),
      start: `${key}-01`,
      revenue: 0,
      unitsSold: 0,
    });
    cursor = addMonths(cursor, 1);
  }

  for (const sale of sales) {
    const bucketDate = startOfMonth(sale.soldAt);
    const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
    const current = buckets.get(key);
    if (!current) {
      continue;
    }

    current.revenue += sale.amount;
    current.unitsSold += 1;
  }

  return Array.from(buckets.values());
}

export async function getReportsOverview(
  storeId: string,
  input: ReportsOverviewInput
): Promise<ReportsOverviewResponse> {
  const salesWhere = {
    storeId,
    ...buildDateRangeWhere("soldAt", input.startDate, input.endDate),
  };
  const tradeInsWhere = {
    storeId,
    ...buildDateRangeWhere("tradeAt", input.startDate, input.endDate),
  };
  const previousWindow = resolvePreviousWindow(input);

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
  ] = await Promise.all([
    prisma.sale.findMany({
      where: salesWhere,
      select: {
        amount: true,
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
          },
        },
      },
      orderBy: { soldAt: "asc" },
    }),
    previousWindow
      ? prisma.sale.findMany({
          where: {
            storeId,
            status: "COMPLETADA",
            soldAt: {
              gte: previousWindow.startDate,
              lte: previousWindow.endDate,
            },
          },
          select: {
            amount: true,
            inventoryItem: {
              select: { cost: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.tradeIn.findMany({
      where: tradeInsWhere,
      select: {
        differencePaid: true,
        status: true,
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
      where: { storeId },
    }),
    prisma.inventoryItem.count({
      where: { storeId, status: "DISPONIBLE" },
    }),
    prisma.inventoryItem.count({
      where: { storeId, status: "VENDIDO" },
    }),
    prisma.inventoryItem.count({
      where: { storeId, status: "EN_REVISION" },
    }),
    prisma.inventoryItem.aggregate({
      where: { storeId, status: "DISPONIBLE" },
      _sum: {
        cost: true,
        price: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where: { storeId, status: "DISPONIBLE" },
      select: {
        createdAt: true,
        cost: true,
      },
    }),
  ]);

  const completedSales: CompletedSale[] = sales
    .filter((sale) => sale.status === "COMPLETADA")
    .map((sale) => ({
      amount: toNumber(sale.amount),
      paymentMethod: sale.paymentMethod,
      soldAt: sale.soldAt,
      clientId: sale.clientId,
      product: buildProductLabel(sale.inventoryItem),
      category: sale.category?.name?.trim() || "Sin categoría",
      clientName: sale.client?.name?.trim() || "Sin cliente",
      cost: toNumber(sale.inventoryItem?.cost),
    }));

  const pendingSaleRows = sales.filter((sale) => sale.status === "PENDIENTE");
  const pendingSales = pendingSaleRows.length;
  const pendingAmount = pendingSaleRows.reduce(
    (accumulator, sale) => accumulator + toNumber(sale.amount),
    0
  );
  const currentMetrics = summarizeCompleted(completedSales);
  const previousMetrics = summarizeCompleted(
    previousSales.map((sale) => ({
      amount: toNumber(sale.amount),
      cost: toNumber(sale.inventoryItem?.cost),
    }))
  );
  const { revenue, grossProfit, unitsSold, averageTicket } = currentMetrics;
  const marginRate = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const approvedTradeIns = tradeIns.filter((tradeIn) => APPROVED_TRADE_IN_STATUSES.has(tradeIn.status)).length;
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

  const approvedTradeInRows = tradeIns.filter((tradeIn) => APPROVED_TRADE_IN_STATUSES.has(tradeIn.status));
  const openTradeInRows = tradeIns.filter((tradeIn) => OPEN_TRADE_IN_STATUSES.has(tradeIn.status));
  const otherTradeInRows = tradeIns.filter(
    (tradeIn) =>
      !APPROVED_TRADE_IN_STATUSES.has(tradeIn.status) && !OPEN_TRADE_IN_STATUSES.has(tradeIn.status)
  );
  const sumDifference = (rows: typeof tradeIns) =>
    rows.reduce((accumulator, tradeIn) => accumulator + toNumber(tradeIn.differencePaid), 0);
  const tradeInCash = sumDifference(approvedTradeInRows);
  const openTradeInCash = sumDifference(openTradeInRows);
  const otherTradeInCash = sumDifference(otherTradeInRows);
  const openTradeIns = openTradeInRows.length;

  return {
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
    },
    clients: {
      totalClients,
      activeClients,
      pendingBalance: toNumber(pendingBalanceAggregate._sum.pendingBalance),
    },
    tradeIns: {
      totalInRange: tradeIns.length,
      approvedInRange: approvedTradeIns,
      openInRange: openTradeIns,
      cashGenerated: tradeInCash,
      openCash: openTradeInCash,
      otherCash: otherTradeInCash,
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

export function getReportsErrorStatus(error: unknown) {
  if (error instanceof ReportsError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}
