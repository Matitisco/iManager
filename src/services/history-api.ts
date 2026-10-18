import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type HistoryChange = { field: string; label: string; before: string | null; after: string | null };

export type HistoryEvent = {
  id: string;
  createdAt: string;
  action: string;
  group: string;
  section: string;
  sectionLabel: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: string | null;
  actorRoleLabel: string | null;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  detail: string | null;
  changes: HistoryChange[];
  reason: string | null;
  source: string | null;
  legacy: boolean;
  title: string;
  verb: string;
  target: string;
  suffix: string;
  recordState: 'active' | 'archived' | 'voided' | 'gone';
};

export type HistoryPage = {
  events: HistoryEvent[];
  nextCursor: string | null;
};

export type HistoryActor = { userId: string; name: string; removed: boolean };

export type HistoryFilters = {
  actorUserId?: string;
  period?: 'today' | '7' | '30' | 'month';
  from?: string;
  to?: string;
  group?: string;
  section?: string;
  q?: string;
  entityType?: string;
  entityId?: string;
  cursor?: string;
  limit?: number;
};

function queryOf(filters: HistoryFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function fetchHistory(user: AuthUserLike, filters: HistoryFilters = {}) {
  return apiRequest<HistoryPage>(user, `/api/history${queryOf(filters)}`, {
    fallback: (status) => status === 403 ? 'No tenés acceso al historial' : `No se pudo cargar el historial (${status})`,
  });
}

export function fetchHistoryActors(user: AuthUserLike) {
  return apiRequest<{ actors: HistoryActor[] }>(user, '/api/history/actors', {
    fallback: 'No se pudieron cargar las personas',
  });
}
