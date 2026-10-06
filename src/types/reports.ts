export type ReportsRangeKey = 'this_month' | 'last_90_days' | 'this_year' | 'all_time' | 'custom';

export type ReportsWidgetId =
  | 'sales-summary'
  | 'sales-by-period'
  | 'inventory-value'
  | 'top-products'
  | 'business-mix'
  | 'payment-methods'
  | 'operational-snapshot';

export interface ReportsWidgetPreferences {
  visibleWidgetIds: ReportsWidgetId[];
  widgetOrder: ReportsWidgetId[];
}

export interface ReportsSeriesPoint {
  label: string;
  start?: string;
  revenue: number;
  unitsSold: number;
}

export interface ReportsOverview {
  filters: {
    rangeKey: ReportsRangeKey;
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    revenue: number;
    grossProfit: number;
    unitsSold: number;
    averageTicket: number;
    pendingSales: number;
    pendingAmount: number;
    marginRate: number;
    approvedTradeIns: number;
  };
  comparison: {
    available: boolean;
    revenue: number;
    grossProfit: number;
    unitsSold: number;
    averageTicket: number;
    revenueChange: number | null;
    grossProfitChange: number | null;
    unitsChange: number | null;
    averageTicketChange: number | null;
  };
  salesSeries: ReportsSeriesPoint[];
  topProducts: Array<{
    product: string;
    unitsSold: number;
    revenue: number;
    share: number;
  }>;
  categories: Array<{
    category: string;
    unitsSold: number;
    revenue: number;
    share: number;
  }>;
  topClients: Array<{
    client: string;
    purchases: number;
    revenue: number;
  }>;
  paymentMethods: Array<{
    label: string;
    revenue: number;
    count: number;
    share: number;
  }>;
  inventory: {
    totalItems: number;
    availableItems: number;
    soldItems: number;
    inReviewItems: number;
    valuation: {
      costValue: number;
      retailValue: number;
    };
    aging: Array<{
      label: string;
      count: number;
      costValue: number;
    }>;
    series?: ReportsSeriesPoint[];
  };
  clients: {
    totalClients: number;
    activeClients: number;
    pendingBalance: number;
  };
  tradeIns: {
    totalInRange: number;
    approvedInRange: number;
    openInRange: number;
    cashGenerated: number;
    openCash?: number;
    otherCash?: number;
    series?: ReportsSeriesPoint[];
  };
}

export interface ReportsOverviewParams {
  rangeKey: ReportsRangeKey;
  startDate?: string | null;
  endDate?: string | null;
}
