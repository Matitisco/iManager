import type { AuthUserLike } from '../types/auth-user';
import type { StoreActivityRange, StoreActivityResponse } from '../lib/store-activity';
import { apiRequest, ApiError } from './api-client';

export async function fetchStoreActivity(user: AuthUserLike, range: StoreActivityRange): Promise<StoreActivityResponse> {
  const path = range === 'all' ? '/admin/store-activity?range=all' : '/admin/store-activity';
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
