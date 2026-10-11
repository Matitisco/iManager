import type { Product } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { readApiErrorMessage } from '../lib/api-message';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendInventoryResponse = {
  inventory?: Product[];
  inventoryItem?: Product;
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

export async function fetchBackendInventory(user: AuthUserLike): Promise<Product[]> {
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
  user: AuthUserLike,
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
    throw new Error(readApiErrorMessage(body, `No se pudo crear el equipo (${response.status})`));
  }

  const data = await parseJson<BackendInventoryResponse>(response);
  if (!data.inventoryItem) {
    throw new Error('Respuesta inválida al crear inventario');
  }

  return data.inventoryItem;
}

export async function updateBackendInventoryItem(user: AuthUserLike, item: Product): Promise<Product> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/inventory/${item.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(readApiErrorMessage(body, `No se pudo actualizar el equipo (${response.status})`));
  }

  const data = await parseJson<BackendInventoryResponse>(response);
  if (!data.inventoryItem) {
    throw new Error('Respuesta inválida al actualizar inventario');
  }

  return data.inventoryItem;
}

export async function deleteBackendInventoryItem(user: AuthUserLike, itemId: string): Promise<void> {
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

