import { apiRequest } from './api-client';
import type { AuthUserLike } from '../types/auth-user';

export type PeriodicReportFrequency = 'BIWEEKLY' | 'MONTHLY';

export interface PeriodicReportSettings {
  enabled: boolean;
  frequency: PeriodicReportFrequency;
  recipients: string[];
  lastSentAt: string | null;
  lastPeriodLabel: string | null;
  lastError: string | null;
}

export interface PeriodicReportInput {
  enabled: boolean;
  frequency: PeriodicReportFrequency;
  recipients: string[];
}

export async function fetchPeriodicReport(user: AuthUserLike) {
  const { settings } = await apiRequest<{ settings: PeriodicReportSettings }>(user, '/api/stores/current/periodic-report', {
    fallback: 'No se pudo cargar el reporte automático',
  });
  return settings;
}

export async function savePeriodicReport(user: AuthUserLike, input: PeriodicReportInput) {
  const { settings } = await apiRequest<{ settings: PeriodicReportSettings }>(user, '/api/stores/current/periodic-report', {
    method: 'PUT',
    body: input,
    fallback: 'No se pudo guardar el reporte automático',
  });
  return settings;
}
