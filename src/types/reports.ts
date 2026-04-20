export type ReportsRangeKey = 'this_month' | 'last_90_days' | 'this_year' | 'all_time' | 'custom';

export type ReportsWidgetId =
  | 'sales-summary'
  | 'sales-by-period'
  | 'inventory-value'
  | 'top-products'
  | 'payment-methods'
  | 'operational-snapshot';

export interface ReportsWidgetPreferences {
  visibleWidgetIds: ReportsWidgetId[];
  widgetOrder: ReportsWidgetId[];
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
    approvedTradeIns: number;
  };
  salesSeries: Array<{
    label: string;
    revenue: number;
    unitsSold: number;
  }>;
  topProducts: Array<{
    product: string;
    unitsSold: number;
    revenue: number;
    share: number;
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
  };
  clients: {
    totalClients: number;
    activeClients: number;
    pendingBalance: number;
  };
  tradeIns: {
    totalInRange: number;
    approvedInRange: number;
    cashGenerated: number;
  };
}

export interface ReportsOverviewParams {
  rangeKey: ReportsRangeKey;
  startDate?: string | null;
  endDate?: string | null;
}
