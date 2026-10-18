import type { Product } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

type BackendInventoryResponse = {
  inventory?: Product[];
  inventoryItem?: Product;
};

export async function fetchBackendInventory(user: AuthUserLike): Promise<Product[]> {
  const data = await apiRequest<BackendInventoryResponse>(user, '/api/inventory', {
    fallback: (status) => `No se pudo cargar el inventario (${status})`,
  });
  return data.inventory ?? [];
}

export async function createBackendInventoryItem(
  user: AuthUserLike,
  item: Omit<Product, 'id'>
): Promise<Product> {
  const data = await apiRequest<BackendInventoryResponse>(user, '/api/inventory', {
    method: 'POST',
    body: item,
    fallback: (status) => `No se pudo crear el equipo (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.inventoryItem) {
    throw new Error('Respuesta inválida al crear inventario');
  }

  return data.inventoryItem;
}

export async function updateBackendInventoryItem(user: AuthUserLike, item: Product): Promise<Product> {
  const data = await apiRequest<BackendInventoryResponse>(user, `/api/inventory/${item.id}`, {
    method: 'PATCH',
    body: item,
    fallback: (status) => `No se pudo actualizar el equipo (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.inventoryItem) {
    throw new Error('Respuesta inválida al actualizar inventario');
  }

  return data.inventoryItem;
}

export async function fetchArchivedInventory(user: AuthUserLike): Promise<Product[]> {
  const data = await apiRequest<BackendInventoryResponse>(user, '/api/inventory?archived=1', {
    fallback: (status) => `No se pudo cargar el archivo (${status})`,
  });
  return data.inventory ?? [];
}

export async function deleteBackendInventoryItem(user: AuthUserLike, itemId: string, reason?: string): Promise<void> {
  await apiRequest<void>(user, `/api/inventory/${itemId}`, {
    method: 'DELETE',
    ...(reason == null ? {} : { body: { reason } }),
    fallback: (status) => `No se pudo archivar el equipo (${status})`,
  });
}

export async function restoreBackendInventoryItem(user: AuthUserLike, itemId: string): Promise<Product> {
  const data = await apiRequest<BackendInventoryResponse>(user, `/api/inventory/${itemId}/restore`, {
    method: 'POST',
    fallback: (status) => `No se pudo restaurar el equipo (${status})`,
  });
  if (!data.inventoryItem) throw new Error('Respuesta inválida al restaurar el equipo');
  return data.inventoryItem;
}
