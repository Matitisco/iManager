import type { AuthUserLike } from '../types/auth-user';
import type { CatalogEdit, NamedCatalog, CatalogSettings, ManagedCatalog, PublicCatalog } from '../types/public-catalog';
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
  const response = await fetchWithTimeout(`${base}/api/public/catalog/${encodeURIComponent(slug)}?_=${Date.now()}`, { cache: 'no-store', signal, headers: { 'Cache-Control': 'no-store' } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, readApiErrorMessage(body, 'No se pudo cargar el catálogo'));
  }
  return response.json();
}

export async function fetchStoreCatalogs(user: AuthUserLike) {
  return (await apiRequest<{ catalogs: NamedCatalog[] }>(user, '/api/catalog/list', { fallback: 'No se pudieron cargar los catálogos' })).catalogs;
}
export async function saveStoreCatalog(user: AuthUserLike, id: string | null, input: CatalogEdit) {
  return (await apiRequest<{ catalog: NamedCatalog }>(user, id ? `/api/catalog/list/${encodeURIComponent(id)}` : '/api/catalog/list', { method: id ? 'PATCH' : 'POST', body: input, fallback: 'No se pudo guardar el catálogo', errorFrom: 'friendly' })).catalog;
}
export async function deleteStoreCatalog(user: AuthUserLike, id: string) {
  await apiRequest(user, `/api/catalog/list/${encodeURIComponent(id)}`, { method: 'DELETE', fallback: 'No se pudo borrar el catálogo', errorFrom: 'friendly' });
}
export async function previewStoreCatalog(user: AuthUserLike, id: string | null, input: CatalogEdit, signal?: AbortSignal) {
  return apiRequest<PublicCatalog>(user, '/api/catalog/preview', { method: 'POST', body: { ...input, ...(id ? { catalogId: id } : {}) }, signal, fallback: 'No se pudo cargar la vista previa', errorFrom: 'friendly' });
}

export async function regenerateStoreCatalog(user: AuthUserLike, id: string) {
  return (await apiRequest<{ catalog: NamedCatalog }>(user, `/api/catalog/list/${encodeURIComponent(id)}/regenerate`, { method: 'POST', fallback: 'No se pudo regenerar el link', errorFrom: 'friendly' })).catalog;
}
