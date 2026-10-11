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

// Fastify rejects an empty body sent with Content-Type: application/json.
async function getDeleteHeaders(user: AuthUserLike) {
  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
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

export async function updateBackendSale(user: AuthUserLike, sale: Sale): Promise<Sale> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/sales/${sale.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({
      clientId: sale.clientId,
      ...(sale.clientName !== undefined ? { clientName: sale.clientName } : {}),
      productId: sale.productId,
      ...(sale.deviceLabel !== undefined ? { deviceLabel: sale.deviceLabel } : {}),
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
    headers: await getDeleteHeaders(user),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar la venta (${response.status})`);
  }
}
