import { apiRequest } from './api-client';
import type { AuthUserLike } from '../types/auth-user';

export type PeriodicReportFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface PeriodicReportSettings {
  sendDay?: number;
  sendTime?: string;
  timezone?: string;
  enabled: boolean;
  frequency: PeriodicReportFrequency;
  recipients: string[];
  lastSentAt: string | null;
  lastPeriodLabel: string | null;
  lastError: string | null;
}

export interface PeriodicReportInput {
  sendDay?: number;
  sendTime?: string;
  timezone?: string;
  enabled: boolean;
  frequency: PeriodicReportFrequency;
  recipients: string[];
}

export async function fetchPeriodicReport(user: AuthUserLike, signal?: AbortSignal) {
  const { settings } = await apiRequest<{ settings: PeriodicReportSettings }>(user, '/api/stores/current/periodic-report', {
    fallback: 'No se pudo cargar el reporte automático', signal,
  });
  return settings;
}

export async function savePeriodicReport(user: AuthUserLike, input: PeriodicReportInput, signal?: AbortSignal) {
  const { settings } = await apiRequest<{ settings: PeriodicReportSettings }>(user, '/api/stores/current/periodic-report', {
    method: 'PUT',
    body: input,
    fallback: 'No se pudo guardar el reporte automático', errorFrom: 'friendly', signal,
  });
  return settings;
}

export async function sendPeriodicReportTest(user: AuthUserLike, input: PeriodicReportInput, signal?: AbortSignal) {
  return apiRequest<{ sent: boolean; message: string }>(user, '/api/stores/current/periodic-report/test', {
    method: 'POST', body: input, fallback: 'No se pudo enviar el mail de prueba', errorFrom: 'friendly', signal,
    // Allow the provider's 15s deadline plus report preparation and the API response.
    timeoutMs: 30000,
  });
}
