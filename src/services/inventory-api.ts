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

export async function deleteBackendInventoryItem(user: AuthUserLike, itemId: string): Promise<void> {
  await apiRequest<void>(user, `/api/inventory/${itemId}`, {
    method: 'DELETE',
    fallback: (status) => `No se pudo eliminar el equipo (${status})`,
  });
}
