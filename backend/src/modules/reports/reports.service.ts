import { prisma } from "../../plugins/prisma.js";

export type ReportsRangeKey = "this_month" | "last_90_days" | "this_year" | "all_time";

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
  approvedTradeIns: number;
}

export interface ReportsSeriesPoint {
  label: string;
  revenue: number;
  unitsSold: number;
}

export interface ReportsTopModel {
  model: string;
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

export interface ReportsInventorySnapshot {
  totalItems: number;
  availableItems: number;
  soldItems: number;
  inReviewItems: number;
}

export interface ReportsClientSnapshot {
  totalClients: number;
  activeClients: number;
  pendingBalance: number;
}

export interface ReportsTradeInSnapshot {
  totalInRange: number;
  approvedInRange: number;
  cashGenerated: number;
}

export interface ReportsOverviewResponse {
  filters: {
    rangeKey: ReportsRangeKey;
    startDate: string | null;
    endDate: string | null;
  };
  summary: ReportsSummary;
  salesSeries: ReportsSeriesPoint[];
  topModels: ReportsTopModel[];
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

type CompletedSale = {
  amount: number;
  paymentMethod: string;
  soldAt: Date;
  clientId: string | null;
  model: string;
  cost: number;
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

  const [
    sales,
    tradeIns,
    totalClients,
    pendingBalanceAggregate,
    totalItems,
    availableItems,
    soldItems,
    inReviewItems,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: salesWhere,
      select: {
        amount: true,
        paymentMethod: true,
        status: true,
        soldAt: true,
        clientId: true,
        inventoryItem: {
          select: {
            model: true,
            cost: true,
          },
        },
      },
      orderBy: { soldAt: "asc" },
    }),
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
  ]);

  const completedSales: CompletedSale[] = sales
    .filter((sale) => sale.status === "COMPLETADA")
    .map((sale) => ({
      amount: toNumber(sale.amount),
      paymentMethod: sale.paymentMethod,
      soldAt: sale.soldAt,
      clientId: sale.clientId,
      model: sale.inventoryItem?.model?.trim() || "Producto sin referencia",
      cost: toNumber(sale.inventoryItem?.cost),
    }));

  const pendingSales = sales.filter((sale) => sale.status === "PENDIENTE").length;
  const revenue = completedSales.reduce((accumulator, sale) => accumulator + sale.amount, 0);
  const grossProfit = completedSales.reduce(
    (accumulator, sale) => accumulator + (sale.amount - sale.cost),
    0
  );
  const unitsSold = completedSales.length;
  const averageTicket = unitsSold > 0 ? revenue / unitsSold : 0;
  const approvedTradeIns = tradeIns.filter((tradeIn) => APPROVED_TRADE_IN_STATUSES.has(tradeIn.status)).length;
  const activeClients = new Set(
    completedSales
      .map((sale) => sale.clientId)
      .filter((clientId): clientId is string => Boolean(clientId))
  ).size;

  const topModelsMap = new Map<string, { unitsSold: number; revenue: number }>();
  for (const sale of completedSales) {
    const current = topModelsMap.get(sale.model) ?? { unitsSold: 0, revenue: 0 };
    current.unitsSold += 1;
    current.revenue += sale.amount;
    topModelsMap.set(sale.model, current);
  }

  const topModels = Array.from(topModelsMap.entries())
    .map(([model, current]) => ({
      model,
      unitsSold: current.unitsSold,
      revenue: current.revenue,
      share: unitsSold > 0 ? (current.unitsSold / unitsSold) * 100 : 0,
    }))
    .sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue)
    .slice(0, 4);

  const paymentMethodMap = new Map<string, { revenue: number; count: number }>();
  for (const sale of completedSales) {
    const current = paymentMethodMap.get(sale.paymentMethod) ?? { revenue: 0, count: 0 };
    current.revenue += sale.amount;
    current.count += 1;
    paymentMethodMap.set(sale.paymentMethod, current);
  }

  const paymentMethods = Array.from(paymentMethodMap.entries())
    .map(([label, current]) => ({
      label,
      revenue: current.revenue,
      count: current.count,
      share: revenue > 0 ? (current.revenue / revenue) * 100 : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const tradeInCash = tradeIns
    .filter((tradeIn) => APPROVED_TRADE_IN_STATUSES.has(tradeIn.status))
    .reduce((accumulator, tradeIn) => accumulator + toNumber(tradeIn.differencePaid), 0);

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
      approvedTradeIns,
    },
    salesSeries: buildSalesSeries(completedSales, input.startDate, input.endDate),
    topModels,
    paymentMethods,
    inventory: {
      totalItems,
      availableItems,
      soldItems,
      inReviewItems,
    },
    clients: {
      totalClients,
      activeClients,
      pendingBalance: toNumber(pendingBalanceAggregate._sum.pendingBalance),
    },
    tradeIns: {
      totalInRange: tradeIns.length,
      approvedInRange: approvedTradeIns,
      cashGenerated: tradeInCash,
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

export function getReportsErrorStatus(error: unknown) {
  if (error instanceof ReportsError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  return null;
}
