import type { Client, RepairOrder } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { readApiErrorMessage } from '../lib/api-message';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export interface RepairOrderInput {
  clientId?: string | null;
  clientName: string;
  device: string;
  imei?: string;
  fault?: string;
  faultTags?: string[];
  estimate?: number | null;
  deposit?: number;
  currency?: 'ARS' | 'USD' | null;
  technician?: string;
  status?: string;
  estimatedDelivery?: string | null;
}

type RepairResult = {
  order?: RepairOrder;
  orders?: RepairOrder[];
  client?: Client | null;
  error?: string;
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
  if (response.status === 204) return {} as RepairResult;
  const body = await response.json().catch(() => null) as RepairResult | null;
  if (!response.ok) throw new Error(readApiErrorMessage(body, `No se pudo guardar la orden (${response.status})`));
  return body ?? {};
}

export async function fetchBackendRepairs(user: AuthUserLike) {
  const body = await request(user, '/api/repairs', { method: 'GET' });
  return body.orders ?? [];
}

export async function createBackendRepair(user: AuthUserLike, input: RepairOrderInput) {
  const body = await request(user, '/api/repairs', { method: 'POST', body: JSON.stringify(input) });
  if (!body.order) throw new Error('Respuesta inválida al crear la orden');
  return { order: body.order, client: body.client ?? null };
}

export async function updateBackendRepair(user: AuthUserLike, id: string, input: Partial<RepairOrderInput>) {
  const body = await request(user, `/api/repairs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  if (!body.order) throw new Error('Respuesta inválida al actualizar la orden');
  return body.order;
}

export async function changeBackendRepairStatus(user: AuthUserLike, id: string, status: string) {
  const body = await request(user, `/api/repairs/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  if (!body.order) throw new Error('Respuesta inválida al cambiar el estado');
  return body.order;
}

export async function deleteBackendRepair(user: AuthUserLike, id: string) {
  await request(user, `/api/repairs/${id}`, { method: 'DELETE' });
}
