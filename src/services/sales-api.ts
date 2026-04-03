import type { User } from 'firebase/auth';
import type { Sale } from '../types';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendSalesResponse = {
  sale?: Sale;
  sales?: Sale[];
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

export async function fetchBackendSales(user: User): Promise<Sale[]> {
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

export async function createBackendSale(user: User, sale: Omit<Sale, 'id'>): Promise<Sale> {
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

export async function updateBackendSale(user: User, sale: Sale): Promise<Sale> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/sales/${sale.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      date: sale.date,
      amount: sale.amount,
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

export async function deleteBackendSale(user: User, saleId: string): Promise<void> {
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
