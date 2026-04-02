import type { User } from 'firebase/auth';
import type { Client } from '../types';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

type BackendClientResponse = {
  client?: Client;
  clients?: Client[];
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

export async function fetchBackendClients(user: User): Promise<Client[]> {
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

export async function createBackendClient(user: User, client: Omit<Client, 'id'>): Promise<Client> {
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

export async function updateBackendClient(user: User, client: Client): Promise<Client> {
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

export async function deleteBackendClient(user: User, clientId: string): Promise<void> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/clients/${clientId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo eliminar el cliente (${response.status})`);
  }
}
