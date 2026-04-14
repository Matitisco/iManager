import type { User } from 'firebase/auth';
import type { Product, InventoryCategory } from '../types';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendInventoryResponse = {
  inventory?: Product[];
  inventoryItem?: Product;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

async function getAuthHeaders(user: User) {
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

export interface InventoryPageParams {
  skip: number;
  take: number;
  search?: string;
  categoryId?: string | null;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  condition?: string;
  status?: string;
  capacity?: string;
  model?: string;
  grade?: string;
  battery?: string;
}

export async function fetchInventoryPage(
  user: User,
  params: InventoryPageParams
): Promise<{ items: Product[]; total: number }> {
  const baseUrl = getBaseUrlOrThrow();
  const qs = new URLSearchParams();
  qs.set('skip', String(params.skip));
  qs.set('take', String(params.take));
  if (params.search) qs.set('search', params.search);
  if (params.categoryId !== undefined) qs.set('categoryId', params.categoryId === null ? 'null' : params.categoryId);
  if (params.sortKey) qs.set('sortKey', params.sortKey);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  if (params.condition) qs.set('condition', params.condition);
  if (params.status) qs.set('status', params.status);
  if (params.capacity) qs.set('capacity', params.capacity);
  if (params.model) qs.set('model', params.model);
  if (params.grade) qs.set('grade', params.grade);
  if (params.battery) qs.set('battery', params.battery);

  const response = await fetchWithTimeout(`${baseUrl}/api/inventory?${qs}`, {
    headers: await getAuthHeaders(user),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al cargar inventario (${response.status})`);
  }
  const data = await parseJson<{ items: Product[]; total: number }>(response);
  return { items: data.items ?? [], total: data.total ?? 0 };
}

export async function fetchInventoryFilteredIds(
  user: User,
  params: Omit<InventoryPageParams, 'skip' | 'take' | 'sortKey' | 'sortDir'>
): Promise<string[]> {
  const baseUrl = getBaseUrlOrThrow();
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.categoryId !== undefined) qs.set('categoryId', params.categoryId === null ? 'null' : params.categoryId);
  if (params.condition) qs.set('condition', params.condition);
  if (params.status) qs.set('status', params.status);
  if (params.capacity) qs.set('capacity', params.capacity);
  if (params.model) qs.set('model', params.model);
  if (params.grade) qs.set('grade', params.grade);
  if (params.battery) qs.set('battery', params.battery);

  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/ids?${qs}`, {
    headers: await getAuthHeaders(user),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al obtener IDs (${response.status})`);
  }
  const data = await parseJson<{ ids: string[] }>(response);
  return data.ids ?? [];
}

export async function fetchBackendInventory(user: User): Promise<Product[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory`, {
    headers: await getAuthHeaders(user),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo cargar el inventario (${response.status})`);
  }

  const data = await parseJson<BackendInventoryResponse>(response);
  return data.inventory ?? [];
}

export async function createBackendInventoryItem(
  user: User,
  item: Omit<Product, 'id'>
): Promise<Product> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo crear el equipo (${response.status})`);
  }

  const data = await parseJson<BackendInventoryResponse>(response);
  if (!data.inventoryItem) {
    throw new Error('Respuesta inválida al crear inventario');
  }

  return data.inventoryItem;
}

export async function updateBackendInventoryItem(user: User, item: Product): Promise<Product> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/${item.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo actualizar el equipo (${response.status})`);
  }

  const data = await parseJson<BackendInventoryResponse>(response);
  if (!data.inventoryItem) {
    throw new Error('Respuesta inválida al actualizar inventario');
  }

  return data.inventoryItem;
}

export async function deleteBackendInventoryItem(user: User, itemId: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const token = await user.getIdToken();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/${itemId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar el equipo (${response.status})`);
  }
}

export async function fetchCategories(user: User): Promise<InventoryCategory[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/categories`, { headers: await getAuthHeaders(user) });
  if (!response.ok) throw new Error(`No se pudieron cargar las categorías (${response.status})`);
  const data = await parseJson<{ categories: InventoryCategory[] }>(response);
  return data.categories;
}

export async function createCategoryApi(user: User, name: string): Promise<InventoryCategory> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/categories`, {
    method: 'POST', headers: await getAuthHeaders(user), body: JSON.stringify({ name }),
  });
  if (!response.ok) { const b = await response.json().catch(() => null); throw new Error(b?.error || `Error al crear categoría`); }
  const data = await parseJson<{ category: InventoryCategory }>(response);
  return data.category;
}

export async function renameCategoryApi(user: User, id: string, name: string): Promise<InventoryCategory> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/categories/${id}`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ name }),
  });
  if (!response.ok) { const b = await response.json().catch(() => null); throw new Error(b?.error || `Error al renombrar categoría`); }
  const data = await parseJson<{ category: InventoryCategory }>(response);
  return data.category;
}

export async function deleteCategoryApi(user: User, id: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const token = await user.getIdToken();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/categories/${id}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok && response.status !== 204) { const b = await response.json().catch(() => null); throw new Error(b?.error || `Error al eliminar categoría`); }
}

export async function reorderCategoriesApi(user: User, ids: string[]): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/categories/reorder`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ ids }),
  });
  if (!response.ok && response.status !== 204) { const b = await response.json().catch(() => null); throw new Error(b?.error || `Error al reordenar categorías`); }
}

export async function bulkMoveCategoryApi(user: User, ids: string[], categoryId: string | null): Promise<number> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/bulk-move`, {
    method: 'POST', headers: await getAuthHeaders(user), body: JSON.stringify({ ids, categoryId }),
  });
  if (!response.ok) { const b = await response.json().catch(() => null); throw new Error(b?.error || `Error al mover equipos`); }
  const data = await parseJson<{ count: number }>(response);
  return data.count;
}
