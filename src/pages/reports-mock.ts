import { formatArDate } from '../lib/ar-date';
import type { ReportsOverview, ReportsRangeKey } from '../types/reports';
import { formatDateInputValue, parseDateInputBoundary } from '../utils/reports';

export type ReportsMockPeriod = 'week' | 'month' | 'quarter' | 'year' | 'custom';

const MONTH_WEEK_REVENUE = [1_350_000, 1_300_000, 400_000, 3_100_000, 2_300_000];
const MONTH_WEEK_UNITS = [3, 4, 1, 5, 5];

const PAYMENT_SHARES = [
  ['Transferencia', 0.4],
  ['Efectivo', 0.27],
  ['Tarjeta', 0.17],
  ['Canje / pago', 0.16],
] as const;

const MODEL_SHARES = [
  ['iPhone 13 128GB', 0.38],
  ['iPhone 14 128GB', 0.33],
  ['Galaxy S23', 0.18],
  ['iPhone 12 64GB', 0.11],
] as const;

export function buildReportsMock(input: {
  period: ReportsMockPeriod;
  startDate?: string | null;
  endDate?: string | null;
}): ReportsOverview {
  const salesSeries = buildSalesSeries(input.period, input.startDate, input.endDate);
  const revenue = salesSeries.reduce((sum, point) => sum + point.revenue, 0);
  const unitsSold = salesSeries.reduce((sum, point) => sum + point.unitsSold, 0);
  const tradeIns = buildTradeIns(input.period);
  const today = new Date();

  return {
    filters: {
      rangeKey: rangeKeyFor(input.period),
      startDate: parseDateInputBoundary(formatDateInputValue(seriesStart(salesSeries) ?? today), 'start'),
      endDate: parseDateInputBoundary(formatDateInputValue(today), 'end'),
    },
    summary: {
      revenue,
      grossProfit: Math.round(revenue * 0.25),
      unitsSold,
      averageTicket: unitsSold > 0 ? Math.round(revenue / unitsSold) : 0,
      pendingSales: input.period === 'week' ? 1 : 2,
      pendingAmount: input.period === 'week' ? 240_000 : 480_000,
      marginRate: 25,
      approvedTradeIns: tradeIns.approvedInRange,
    },
    comparison: {
      available: true,
      revenue: Math.round(revenue / 1.12),
      grossProfit: Math.round(revenue * 0.2),
      unitsSold: Math.max(1, unitsSold - 2),
      averageTicket: unitsSold > 0 ? Math.round(revenue / unitsSold / 1.04) : 0,
      revenueChange: 12,
      grossProfitChange: 18,
      unitsChange: 12,
      averageTicketChange: 4,
    },
    salesSeries,
    topProducts: shareRows(MODEL_SHARES, revenue).map(([product, amount, share]) => ({
      product,
      unitsSold: Math.max(1, Math.round(unitsSold * share)),
      revenue: amount,
      share: share * 100,
    })),
    categories: [],
    topClients: [],
    paymentMethods: shareRows(PAYMENT_SHARES, revenue).map(([label, amount, share]) => ({
      label,
      revenue: amount,
      count: Math.max(1, Math.round(unitsSold * share)),
      share: share * 100,
    })),
    inventory: {
      totalItems: 48,
      availableItems: 28,
      soldItems: 14,
      inReviewItems: 6,
      valuation: {
        costValue: 18_400_000,
        retailValue: 24_600_000,
      },
      aging: [
        { label: '0-14 días', count: 8, costValue: 6_200_000 },
        { label: '15-30 días', count: 7, costValue: 4_800_000 },
        { label: '31-60 días', count: 6, costValue: 4_100_000 },
        { label: 'Más de 60 días', count: 7, costValue: 3_300_000 },
      ],
    },
    clients: {
      totalClients: 86,
      activeClients: 24,
      pendingBalance: 320_000,
    },
    tradeIns,
  };
}

function rangeKeyFor(period: ReportsMockPeriod): ReportsRangeKey {
  if (period === 'quarter') return 'last_90_days';
  if (period === 'year') return 'this_year';
  return 'custom';
}

function seriesStart(series: ReportsOverview['salesSeries']) {
  const start = series[0]?.start;
  if (!start) return null;
  const [year, month, day] = start.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function buildSalesSeries(
  period: ReportsMockPeriod,
  startDate?: string | null,
  endDate?: string | null
): ReportsOverview['salesSeries'] {
  if (period === 'year') {
    return buildYearSeries();
  }

  if (period === 'week') {
    return spreadAcross(lastDays(7), 2_300_000, 5);
  }

  if (period === 'quarter') {
    return placeOnGroupEnds(lastDays(91), waveTotals(13, 900_000), waveTotals(13, 4));
  }

  if (period === 'custom') {
    const days = daysBetween(startDate, endDate);
    const weeks = Math.max(1, Math.round(days.length / 7));
    if (days.length <= 16) {
      return spreadAcross(days, 450_000 * weeks, Math.max(4, weeks * 3));
    }
    return placeOnGroupEnds(days, waveTotals(weeks, 800_000), waveTotals(weeks, 3));
  }

  return placeOnGroupEnds(lastDays(35), MONTH_WEEK_REVENUE, MONTH_WEEK_UNITS);
}

function buildYearSeries(): ReportsOverview['salesSeries'] {
  const today = startOfDay(new Date());
  const points: ReportsOverview['salesSeries'] = [];

  for (let month = 0; month <= today.getMonth(); month += 1) {
    const date = new Date(today.getFullYear(), month, 1);
    const wave = 0.62 + 0.38 * Math.sin((month / 11) * Math.PI);
    points.push({
      label: formatArDate(date),
      start: isoDay(date),
      revenue: Math.round(1_800_000 * wave),
      unitsSold: Math.max(2, Math.round(8 * wave)),
    });
  }

  return points;
}

function buildTradeIns(period: ReportsMockPeriod) {
  const factor = period === 'week' ? 1 : period === 'quarter' ? 3 : period === 'year' ? 6 : 2;
  const approvedInRange = 3 * factor;
  const openInRange = 2 * factor;
  const other = factor;

  return {
    totalInRange: approvedInRange + openInRange + other,
    approvedInRange,
    openInRange,
    cashGenerated: 320_000 * factor,
    openCash: 90_000 * factor,
    otherCash: 40_000 * factor,
  };
}

function shareRows(rows: ReadonlyArray<readonly [string, number]>, total: number) {
  let assigned = 0;
  return rows.map(([label, share], index) => {
    const amount = index === rows.length - 1 ? total - assigned : Math.round(total * share);
    assigned += amount;
    return [label, amount, total > 0 ? amount / total : 0] as const;
  });
}

function spreadAcross(days: Date[], revenue: number, units: number): ReportsOverview['salesSeries'] {
  const weights = days.map((_, index) => 0.7 + 0.6 * Math.sin((index / Math.max(days.length - 1, 1)) * Math.PI));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let revenueLeft = revenue;
  let unitsLeft = units;

  return days.map((date, index) => {
    const isLast = index === days.length - 1;
    const dayRevenue = isLast ? revenueLeft : Math.round((revenue * weights[index]) / weightSum);
    const dayUnits = isLast ? unitsLeft : Math.max(0, Math.round((units * weights[index]) / weightSum));
    revenueLeft -= dayRevenue;
    unitsLeft -= dayUnits;
    return {
      label: dayLabel(date),
      start: isoDay(date),
      revenue: dayRevenue,
      unitsSold: dayUnits,
    };
  });
}

function placeOnGroupEnds(days: Date[], revenues: number[], units: number[]): ReportsOverview['salesSeries'] {
  return days.map((date, index) => {
    const fromEnd = days.length - 1 - index;
    const isGroupEnd = fromEnd % 7 === 0;
    const groupFromEnd = Math.floor(fromEnd / 7);
    const groupIndex = revenues.length - 1 - groupFromEnd;
    return {
      label: dayLabel(date),
      start: isoDay(date),
      revenue: isGroupEnd ? revenues[groupIndex] ?? 0 : 0,
      unitsSold: isGroupEnd ? units[groupIndex] ?? 0 : 0,
    };
  });
}

function waveTotals(count: number, peak: number) {
  return Array.from({ length: count }, (_, index) => {
    const wave = 0.45 + 0.55 * Math.sin((index / Math.max(count - 1, 1)) * Math.PI);
    return Math.max(1, Math.round(peak * wave));
  });
}

function daysBetween(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) {
    return lastDays(14);
  }

  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return lastDays(14);
  }

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end && days.length < 120) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days.length > 0 ? days : lastDays(14);
}

function lastDays(count: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return date;
  });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function isoDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayLabel(date: Date) {
  return formatArDate(date);
}
