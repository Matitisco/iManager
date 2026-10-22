import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface NetProfitReport {
  currency: 'ARS' | 'USD';
  sellRate: number | null;
  blocked: boolean;
  revenue: number | null;
  cost: number | null;
  grossProfit: number | null;
  expenses: number | null;
  netProfit: number | null;
}

export function fetchNetProfit(user: AuthUserLike, from: string, to: string) {
  return apiRequest<NetProfitReport>(user, `/api/reports/net-profit?${new URLSearchParams({ from, to })}`, {
    fallback: 'No se pudo cargar el resumen mensual de gastos',
  });
}
