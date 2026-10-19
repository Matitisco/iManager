import type { AuthUserLike } from '../types/auth-user';
import type { Client } from '../types';
import { apiRequest } from './api-client';

type BackendClientResponse = {
  client?: Client;
  clients?: Client[];
};

export async function fetchBackendClients(user: AuthUserLike): Promise<Client[]> {
  const data = await apiRequest<BackendClientResponse>(user, '/api/clients', {
    fallback: (status) => `No se pudieron cargar los clientes (${status})`,
  });
  return data.clients ?? [];
}

export async function createBackendClient(user: AuthUserLike, client: Omit<Client, 'id'>): Promise<Client> {
  const data = await apiRequest<BackendClientResponse>(user, '/api/clients', {
    method: 'POST',
    body: client,
    fallback: (status) => `No se pudo crear el cliente (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.client) {
    throw new Error('Respuesta inválida al crear cliente');
  }

  return data.client;
}

export async function updateBackendClient(user: AuthUserLike, client: Client): Promise<Client> {
  const data = await apiRequest<BackendClientResponse>(user, `/api/clients/${client.id}`, {
    method: 'PATCH',
    body: client,
    fallback: (status) => `No se pudo actualizar el cliente (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.client) {
    throw new Error('Respuesta inválida al actualizar cliente');
  }

  return data.client;
}

export type ClientPaymentRecord = {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  kind?: string;
  note?: string | null;
  saleId?: string | null;
  currency?: string | null;
};

export async function fetchClientPayments(user: AuthUserLike, clientId: string): Promise<ClientPaymentRecord[]> {
  const data = await apiRequest<{ payments?: ClientPaymentRecord[] }>(user, `/api/clients/${clientId}/payments`, {
    fallback: 'No se pudieron cargar los pagos',
    errorFrom: 'fallback',
  });
  return data.payments ?? [];
}

export async function registerBackendClientPayment(
  user: AuthUserLike,
  clientId: string,
  input: { amount: number; method: string; currency?: string | null },
): Promise<Client> {
  const data = await apiRequest<BackendClientResponse>(user, `/api/clients/${clientId}/payments`, {
    method: 'POST',
    body: input,
    fallback: 'No se pudo registrar el pago',
    errorFrom: 'friendly',
  });
  if (!data.client) throw new Error('Respuesta inválida al registrar el pago');
  return data.client;
}

export async function fetchArchivedClients(user: AuthUserLike): Promise<Client[]> {
  const data = await apiRequest<BackendClientResponse>(user, '/api/clients?archived=1', {
    fallback: (status) => `No se pudo cargar el archivo (${status})`,
  });
  return data.clients ?? [];
}

export async function deleteBackendClient(user: AuthUserLike, clientId: string, reason?: string): Promise<void> {
  await apiRequest<void>(user, `/api/clients/${clientId}`, {
    method: 'DELETE',
    ...(reason == null ? {} : { body: { reason } }),
    fallback: (status) => `No se pudo archivar el cliente (${status})`,
  });
}

export async function restoreBackendClient(user: AuthUserLike, clientId: string): Promise<Client> {
  const data = await apiRequest<BackendClientResponse>(user, `/api/clients/${clientId}/restore`, {
    method: 'POST',
    fallback: (status) => `No se pudo restaurar el cliente (${status})`,
  });
  if (!data.client) throw new Error('Respuesta inválida al restaurar el cliente');
  return data.client;
}

export type ClientCategoryApi = { id: string; name: string };

export async function fetchClientCategoriesApi(user: AuthUserLike): Promise<ClientCategoryApi[]> {
  const data = await apiRequest<{ categories?: ClientCategoryApi[] }>(user, '/api/clients/categories', {
    fallback: 'No se pudieron cargar las categorías de clientes',
    errorFrom: 'fallback',
  });
  return data.categories ?? [];
}
