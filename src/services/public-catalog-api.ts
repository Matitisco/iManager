import type { AuthUserLike } from '../types/auth-user';
import type { CatalogSettings, ManagedCatalog, PublicCatalog } from '../types/public-catalog';
import { apiRequest, ApiError } from './api-client';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';
import { readApiErrorMessage } from '../lib/api-message';

export async function fetchCatalogSettings(user: AuthUserLike) {
  return (await apiRequest<{ catalog: ManagedCatalog | null }>(user, '/api/catalog', { fallback: 'No se pudo cargar el catálogo' })).catalog;
}
export async function saveCatalogSettings(user: AuthUserLike, input: Partial<CatalogSettings>) {
  return (await apiRequest<{ catalog: ManagedCatalog }>(user, '/api/catalog', { method: 'PATCH', body: input, fallback: 'No se pudo guardar el catálogo', errorFrom: 'friendly' })).catalog;
}
export async function regenerateCatalog(user: AuthUserLike) {
  return (await apiRequest<{ catalog: ManagedCatalog }>(user, '/api/catalog/regenerate', { method: 'POST', fallback: 'No se pudo regenerar el link' })).catalog;
}
export async function changeCatalogVisibility(user: AuthUserLike, ids: string[], visible: boolean) {
  return (await apiRequest<{ catalog: ManagedCatalog }>(user, '/api/catalog/items', { method: 'PATCH', body: { ids, visible }, fallback: 'No se pudo cambiar la visibilidad', errorFrom: 'friendly' })).catalog;
}
export async function fetchPublicCatalog(slug: string, signal?: AbortSignal): Promise<PublicCatalog> {
  const base = getBackendBaseUrl();
  if (!base) throw new Error('Backend no configurado');
  const response = await fetchWithTimeout(`${base}/api/public/catalog/${encodeURIComponent(slug)}`, { cache: 'no-store', signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, readApiErrorMessage(body, 'No se pudo cargar el catálogo'));
  }
  return response.json();
}
