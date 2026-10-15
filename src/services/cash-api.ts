import type { AuthUserLike } from '../types/auth-user';
import type { CashCommand, CashData, CashFilters, CashHistory, CashSession } from '../types/cash';
import { apiRequest } from './api-client';
export const fetchCash = (user: AuthUserLike) => apiRequest<CashData>(user, '/api/cash', { fallback: 'No se pudieron cargar las cajas' });
export const cashCommand = (user: AuthUserLike, command: CashCommand) => apiRequest<unknown>(user, `/api/cash${command.path}`, { method: command.method, body: command.body, fallback: 'No se pudo guardar el cambio en caja', errorFrom: 'friendly' });
export function fetchCashHistory(user: AuthUserLike, id: string, filters: CashFilters) {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(filters)) if (value !== undefined && value !== '') query.set(key, String(value));
  return apiRequest<CashHistory>(user, `/api/cash/${encodeURIComponent(id)}/movements?${query}`, { fallback: 'No se pudo cargar el historial de caja', errorFrom: 'friendly' });
}
export const fetchCashSessions = (user: AuthUserLike, id: string) => apiRequest<{ sessions: CashSession[] }>(user, `/api/cash/${encodeURIComponent(id)}/sessions`, { fallback: 'No se pudieron cargar los cierres', errorFrom: 'friendly' });
