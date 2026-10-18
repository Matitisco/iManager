import type { AuthUserLike } from '../types/auth-user';
import type { StoreActivityRange, StoreActivityResponse } from '../lib/store-activity';
import type { FunnelResponse, TimelineResponse } from '../lib/admin-panel';
import { apiRequest, ApiError } from './api-client';

export async function fetchStoreActivity(user: AuthUserLike, range: StoreActivityRange): Promise<StoreActivityResponse> {
  const path = range === '30d' ? '/admin/store-activity' : `/admin/store-activity?range=${range}`;
  return apiRequest<StoreActivityResponse>(user, path, {
    fallback: (status) => (status === 404 ? 'No encontrado' : 'No pudimos cargar la actividad.'),
    errorFrom: 'fallback',
  });
}

/** Capability probe uses the same 401/403 contract as admin data endpoints. */
export async function fetchAdminAccess(user: AuthUserLike): Promise<{ isAdmin: boolean }> {
  try {
    return await apiRequest(user, '/api/me/admin', { fallback: 'No pudimos comprobar el acceso.', errorFrom: 'fallback' });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return { isAdmin: false };
    throw error;
  }
}

export function fetchFunnel(user: AuthUserLike, range: StoreActivityRange, hideTests: boolean): Promise<FunnelResponse> {
  return apiRequest(user, `/admin/funnel?range=${range}&tests=${hideTests ? 'hide' : 'show'}`, {
    fallback: 'No pudimos cargar el embudo.', errorFrom: 'fallback',
  });
}

export function fetchStoreTimeline(user: AuthUserLike, id: string): Promise<TimelineResponse> {
  return apiRequest(user, `/admin/stores/${encodeURIComponent(id)}/timeline`, {
    fallback: 'No pudimos cargar el recorrido.', errorFrom: 'fallback',
  });
}
