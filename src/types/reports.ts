export type ReportsRangeKey = 'this_month' | 'last_90_days' | 'this_year' | 'all_time';

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
  topModels: Array<{
    model: string;
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
