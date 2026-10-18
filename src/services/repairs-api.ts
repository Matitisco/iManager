import type { Client, RepairOrder } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface RepairOrderInput {
  clientId?: string | null;
  clientName?: string | null;
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
  warrantyDays?: number;
}

type RepairResult = {
  order?: RepairOrder;
  orders?: RepairOrder[];
  client?: Client | null;
};

async function request(user: AuthUserLike, path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const result = await apiRequest<RepairResult | undefined>(user, path, {
    method,
    body,
    fallback: (status) => `No se pudo guardar la orden (${status})`,
    errorFrom: 'friendly',
  });
  return result ?? {};
}

export async function fetchBackendRepairs(user: AuthUserLike) {
  const body = await request(user, '/api/repairs', 'GET');
  return body.orders ?? [];
}

export async function createBackendRepair(user: AuthUserLike, input: RepairOrderInput) {
  const body = await request(user, '/api/repairs', 'POST', input);
  if (!body.order) throw new Error('Respuesta inválida al crear la orden');
  return { order: body.order, client: body.client ?? null };
}

export async function updateBackendRepair(user: AuthUserLike, id: string, input: Partial<RepairOrderInput>) {
  const body = await request(user, `/api/repairs/${id}`, 'PATCH', input);
  if (!body.order) throw new Error('Respuesta inválida al actualizar la orden');
  return { order: body.order, client: body.client ?? null };
}

export async function changeBackendRepairStatus(user: AuthUserLike, id: string, status: string) {
  const body = await request(user, `/api/repairs/${id}/status`, 'POST', { status });
  if (!body.order) throw new Error('Respuesta inválida al cambiar el estado');
  return body.order;
}

export async function fetchArchivedRepairs(user: AuthUserLike) {
  const body = await request(user, '/api/repairs?archived=1', 'GET');
  return body.orders ?? [];
}

export async function deleteBackendRepair(user: AuthUserLike, id: string, reason?: string) {
  await request(user, `/api/repairs/${id}`, 'DELETE', reason == null ? undefined : { reason });
}

export async function restoreBackendRepair(user: AuthUserLike, id: string) {
  const body = await request(user, `/api/repairs/${id}/restore`, 'POST');
  if (!body.order) throw new Error('Respuesta inválida al restaurar la orden');
  return body.order;
}
