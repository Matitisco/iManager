import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface SummaryPeriod {
  id: string;
  kind: 'month' | 'half';
  from: string;
  to: string;
  label: string;
}
export interface SummaryAmount { amount: number; currency: string | null }
export interface SummarySale extends SummaryAmount {
  id: string; day: string; title: string; detail: string; voided: boolean;
}
export interface SummaryReturn extends SummaryAmount {
  id: string; day: string; title: string; detail: string; pending: boolean; status: string;
}
export interface SummaryStock {
  id: string; day: string; title: string; imei: string; status: 'Falta' | 'Sobra' | 'Figura vendido';
}
export interface PeriodicSummary {
  period: SummaryPeriod;
  periods: { months: SummaryPeriod[]; halves: SummaryPeriod[] };
  sales: { total: SummaryAmount[]; items: SummarySale[] } | null;
  returns: { total: SummaryAmount[]; items: SummaryReturn[] } | null;
  stock: { count: number; counts: number; latestDay: string | null; items: SummaryStock[] } | null;
}

export function fetchPeriodicSummary(user: AuthUserLike, period: string, signal?: AbortSignal) {
  return apiRequest<PeriodicSummary>(user, `/api/reports/periodic-summary?${new URLSearchParams({ period })}`, {
    fallback: 'No se pudo cargar el resumen periódico', signal,
  });
}
