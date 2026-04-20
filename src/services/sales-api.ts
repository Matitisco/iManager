import type { Sale } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendSalesResponse = {
  sale?: Sale;
  sales?: Sale[];
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

export async function fetchBackendSales(user: AuthUserLike): Promise<Sale[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/sales`, {
    headers: await getAuthHeaders(user),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudieron cargar las ventas (${response.status})`);
  }

  const data = await parseJson<BackendSalesResponse>(response);
  return data.sales ?? [];
}

export async function createBackendSale(user: AuthUserLike, sale: Omit<Sale, 'id'>): Promise<Sale> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/sales`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(sale),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo crear la venta (${response.status})`);
  }

  const data = await parseJson<BackendSalesResponse>(response);
  if (!data.sale) {
    throw new Error('Respuesta inválida al crear venta');
  }

  return data.sale;
}

export async function updateBackendSale(user: AuthUserLike, sale: Sale): Promise<Sale> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/sales/${sale.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({
      clientId: sale.clientId,
      productId: sale.productId,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      date: sale.date,
      amount: sale.amount,
      categoryId: sale.categoryId ?? null,
      customFields: sale.customFields,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo actualizar la venta (${response.status})`);
  }

  const data = await parseJson<BackendSalesResponse>(response);
  if (!data.sale) {
    throw new Error('Respuesta inválida al actualizar venta');
  }

  return data.sale;
}

export async function deleteBackendSale(user: AuthUserLike, saleId: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/sales/${saleId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar la venta (${response.status})`);
  }
}

// ── Categories ───────────────────────────────────────────────────────────────

export type Category = { id: string; name: string };

export async function fetchSalesCategoriesApi(user: AuthUserLike): Promise<Category[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/sales/categories`, {
    headers: await getAuthHeaders(user),
  });
  if (!response.ok) throw new Error(`No se pudieron cargar las categorías de ventas`);
  const data = await response.json();
  return data.categories ?? [];
}

export async function createSaleCategoryApi(user: AuthUserLike, name: string): Promise<Category> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/sales/categories`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`Error creando categoría`);
  const data = await response.json();
  return data.category;
}

export async function renameSaleCategoryApi(user: AuthUserLike, id: string, name: string): Promise<Category> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/sales/categories/${id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`Error renombrando categoría`);
  const data = await response.json();
  return data.category;
}

export async function deleteSaleCategoryApi(user: AuthUserLike, id: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/sales/categories/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });
  if (!response.ok) throw new Error(`Error eliminando categoría`);
}

export async function reorderSalesCategoriesApi(user: AuthUserLike, categoryIds: string[]): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/sales/categories/reorder`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ categoryIds }),
  });
  if (!response.ok) throw new Error(`Error reordenando categorías`);
}

export async function bulkMoveSalesCategoryApi(user: AuthUserLike, itemIds: string[], categoryId: string | null): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetch(`${baseUrl}/api/sales/categories/bulk-move`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ itemIds, categoryId }),
  });
  if (!response.ok) throw new Error(`Error moviendo elementos`);
}
