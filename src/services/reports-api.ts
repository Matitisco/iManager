import { apiRequest } from './api-client';
import type { AuthUserLike } from '../types/auth-user';

export interface OverviewSeriesPoint {
  label: string;
  start: string;
  revenue: number;
  unitsSold: number;
}

export interface ReportsOverview {
  summary: { revenue: number; grossProfit: number; marginRate: number; unitsSold: number };
  comparison: { available: boolean; revenueChange: number | null; grossProfitChange: number | null; unitsChange: number | null };
  salesSeries: OverviewSeriesPoint[];
  paymentMethods: Array<{ label: string; revenue: number; count: number; share: number }>;
}

export async function fetchReportsOverview(user: AuthUserLike, startDate: string, endDate: string, signal?: AbortSignal) {
  const query = new URLSearchParams({
    rangeKey: 'custom',
    startDate: `${startDate}T00:00:00.000-03:00`,
    endDate: `${endDate}T23:59:59.999-03:00`,
  });
  const { overview } = await apiRequest<{ overview: ReportsOverview }>(user, `/api/reports/overview?${query}`, {
    fallback: 'No se pudo consultar el período', signal,
  });
  return overview;
}
