import type { Accessory, AccessoryMovement } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import type { OperationNotification } from './operations-api';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export interface AccessoryInput {
  name: string;
  category: string;
  compatibleWith?: string;
  sku?: string;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
}

type AccessoryResult = {
  accessory?: Accessory;
  accessories?: Accessory[];
  notifications?: OperationNotification[];
};

async function headers(user: AuthUserLike, withBody = true) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

function baseUrl() {
  const value = getBackendBaseUrl();
  if (!value) throw new Error('Backend no configurado');
  return value.replace(/\/+$/, '');
}

async function request(user: AuthUserLike, path: string, init: RequestInit = {}) {
  const response = await fetchWithTimeout(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...(await headers(user, init.body !== undefined)), ...init.headers },
  });
  if (response.status === 204) return {} as AccessoryResult;
  const body = await response.json().catch(() => null) as (AccessoryResult & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || `No se pudo guardar el accesorio (${response.status})`);
  return body ?? {};
}

export async function fetchBackendAccessories(user: AuthUserLike) {
  const body = await request(user, '/api/accessories', { method: 'GET' });
  return body.accessories ?? [];
}

export async function fetchBackendAccessory(user: AuthUserLike, id: string) {
  const body = await request(user, `/api/accessories/${id}`, { method: 'GET' });
  if (!body.accessory) throw new Error('Respuesta inválida al cargar el accesorio');
  return body.accessory;
}

export async function createBackendAccessory(user: AuthUserLike, input: AccessoryInput) {
  const body = await request(user, '/api/accessories', { method: 'POST', body: JSON.stringify(input) });
  if (!body.accessory) throw new Error('Respuesta inválida al crear el accesorio');
  return body as { accessory: Accessory; notifications?: OperationNotification[] };
}

export async function updateBackendAccessory(user: AuthUserLike, id: string, input: Partial<AccessoryInput>) {
  const body = await request(user, `/api/accessories/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  if (!body.accessory) throw new Error('Respuesta inválida al actualizar el accesorio');
  return body as { accessory: Accessory; notifications?: OperationNotification[] };
}

export async function deleteBackendAccessory(user: AuthUserLike, id: string) {
  await request(user, `/api/accessories/${id}`, { method: 'DELETE' });
}

export type { AccessoryMovement };
