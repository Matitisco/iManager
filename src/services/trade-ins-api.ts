import type { TradeIn } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendTradeInsResponse = {
  tradeIn?: TradeIn;
  tradeIns?: TradeIn[];
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

async function getAuthHeaders(user: AuthUserLike) {
  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getBaseUrlOrThrow() {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    throw new Error('Backend no configurado');
  }

  return trimTrailingSlash(baseUrl);
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function fetchBackendTradeIns(user: AuthUserLike): Promise<TradeIn[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins`, {
    headers: await getAuthHeaders(user),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudieron cargar los canjes (${response.status})`);
  }

  const data = await parseJson<BackendTradeInsResponse>(response);
  return data.tradeIns ?? [];
}

export async function createBackendTradeIn(user: AuthUserLike, tradeIn: Omit<TradeIn, 'id'>): Promise<TradeIn> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(tradeIn),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo crear el canje (${response.status})`);
  }

  const data = await parseJson<BackendTradeInsResponse>(response);
  if (!data.tradeIn) {
    throw new Error('Respuesta inválida al crear canje');
  }

  return data.tradeIn;
}

export async function updateBackendTradeIn(user: AuthUserLike, tradeIn: TradeIn): Promise<TradeIn> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/${tradeIn.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(tradeIn),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo actualizar el canje (${response.status})`);
  }

  const data = await parseJson<BackendTradeInsResponse>(response);
  if (!data.tradeIn) {
    throw new Error('Respuesta inválida al actualizar canje');
  }

  return data.tradeIn;
}

export async function deleteBackendTradeIn(user: AuthUserLike, tradeInId: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/${tradeInId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar el canje (${response.status})`);
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export type TradeInCategoryApi = { id: string; name: string };

export async function fetchTradeInCategoriesApi(user: AuthUserLike): Promise<TradeInCategoryApi[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/categories`, { headers: await getAuthHeaders(user) });
  if (!response.ok) throw new Error('No se pudieron cargar las categorías de canjes');
  const data = await response.json();
  return data.categories ?? [];
}

export async function createTradeInCategoryApi(user: AuthUserLike, name: string): Promise<TradeInCategoryApi> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/categories`, {
    method: 'POST', headers: await getAuthHeaders(user), body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Error creando categoría de canje');
  return (await response.json()).category;
}

export async function renameTradeInCategoryApi(user: AuthUserLike, id: string, name: string): Promise<TradeInCategoryApi> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/categories/${id}`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Error renombrando categoría de canje');
  return (await response.json()).category;
}

export async function deleteTradeInCategoryApi(user: AuthUserLike, id: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/categories/${id}`, {
    method: 'DELETE', headers: await getAuthHeaders(user),
  });
  if (!response.ok && response.status !== 204) throw new Error('Error eliminando categoría de canje');
}

export async function reorderTradeInCategoriesApi(user: AuthUserLike, categoryIds: string[]): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/categories/reorder`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ categoryIds }),
  });
  if (!response.ok && response.status !== 204) throw new Error('Error reordenando categorías de canje');
}

export async function bulkMoveTradeInCategoryApi(user: AuthUserLike, itemIds: string[], categoryId: string | null): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/trade-ins/categories/bulk-move`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ itemIds, categoryId }),
  });
  if (!response.ok && response.status !== 204) throw new Error('Error moviendo canjes a categoría');
}
