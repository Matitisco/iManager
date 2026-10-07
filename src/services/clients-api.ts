import type { AuthUserLike } from '../types/auth-user';
import type { Client } from '../types';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendClientResponse = {
  client?: Client;
  clients?: Client[];
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

export async function fetchBackendClients(user: AuthUserLike): Promise<Client[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients`, {
    headers: await getAuthHeaders(user),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudieron cargar los clientes (${response.status})`);
  }

  const data = await parseJson<BackendClientResponse>(response);
  return data.clients ?? [];
}

export async function createBackendClient(user: AuthUserLike, client: Omit<Client, 'id'>): Promise<Client> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(client),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo crear el cliente (${response.status})`);
  }

  const data = await parseJson<BackendClientResponse>(response);
  if (!data.client) {
    throw new Error('Respuesta inválida al crear cliente');
  }

  return data.client;
}

export async function updateBackendClient(user: AuthUserLike, client: Client): Promise<Client> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/${client.id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(client),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo actualizar el cliente (${response.status})`);
  }

  const data = await parseJson<BackendClientResponse>(response);
  if (!data.client) {
    throw new Error('Respuesta inválida al actualizar cliente');
  }

  return data.client;
}

export type ClientPaymentRecord = { id: string; amount: number; method: string; paidAt: string };

export async function fetchClientPayments(user: AuthUserLike, clientId: string): Promise<ClientPaymentRecord[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/${clientId}/payments`, {
    headers: await getAuthHeaders(user),
  });
  if (!response.ok) throw new Error('No se pudieron cargar los pagos');
  const data = await parseJson<{ payments?: ClientPaymentRecord[] }>(response);
  return data.payments ?? [];
}

export async function registerBackendClientPayment(
  user: AuthUserLike,
  clientId: string,
  input: { amount: number; method: string },
): Promise<Client> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/${clientId}/payments`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'No se pudo registrar el pago');
  }
  const data = await parseJson<BackendClientResponse>(response);
  if (!data.client) throw new Error('Respuesta inválida al registrar el pago');
  return data.client;
}

export async function deleteBackendClient(user: AuthUserLike, clientId: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/${clientId}`, {
    method: 'DELETE',
    headers: await getDeleteHeaders(user),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar el cliente (${response.status})`);
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export type ClientCategoryApi = { id: string; name: string };

export async function fetchClientCategoriesApi(user: AuthUserLike): Promise<ClientCategoryApi[]> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/categories`, { headers: await getAuthHeaders(user) });
  if (!response.ok) throw new Error('No se pudieron cargar las categorías de clientes');
  const data = await response.json();
  return data.categories ?? [];
}

export async function createClientCategoryApi(user: AuthUserLike, name: string): Promise<ClientCategoryApi> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/categories`, {
    method: 'POST', headers: await getAuthHeaders(user), body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Error creando categoría de cliente');
  return (await response.json()).category;
}

export async function renameClientCategoryApi(user: AuthUserLike, id: string, name: string): Promise<ClientCategoryApi> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/categories/${id}`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Error renombrando categoría de cliente');
  return (await response.json()).category;
}

export async function deleteClientCategoryApi(user: AuthUserLike, id: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/categories/${id}`, {
    method: 'DELETE', headers: await getDeleteHeaders(user),
  });
  if (!response.ok && response.status !== 204) throw new Error('Error eliminando categoría de cliente');
}

export async function reorderClientCategoriesApi(user: AuthUserLike, categoryIds: string[]): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/categories/reorder`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ categoryIds }),
  });
  if (!response.ok && response.status !== 204) throw new Error('Error reordenando categorías de cliente');
}

export async function bulkMoveClientCategoryApi(user: AuthUserLike, itemIds: string[], categoryId: string | null): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/categories/bulk-move`, {
    method: 'PATCH', headers: await getAuthHeaders(user), body: JSON.stringify({ itemIds, categoryId }),
  });
  if (!response.ok && response.status !== 204) throw new Error('Error moviendo clientes a categoría');
}
