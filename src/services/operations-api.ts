import type { Accessory, Client, OperationClientOption, OperationProductOption, Product, Sale, TradeIn } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type OperationSource = 'inventory' | 'sales' | 'tradeins' | 'clients';
export type OperationSaleStatus = 'COMPLETADA' | 'PENDIENTE';

export interface OperationInput {
  date?: string;
  clientId?: string | null;
  clientName?: string;
  productId?: string | null;
  deviceLabel?: string;
  amount?: number;
  paymentMethod?: string;
  status?: OperationSaleStatus;
  categoryId?: string | null;
  saleCategoryId?: string | null;
  customFields?: Record<string, unknown>;
  requestKey?: string;
  draft?: boolean;
  tradeIn?: {
    deviceReceived: string;
    deviceReceivedImei?: string;
    takeValue: number;
    status?: string;
    batteryHealth?: string;
    grade?: string;
    customFields?: Record<string, unknown>;
  };
  accessories?: { accessoryId: string; quantity: number }[];
}

export interface OperationResult {
  sale?: Sale;
  tradeIn?: TradeIn;
  inventory: Product[];
  clients: Client[];
  accessories?: Accessory[];
  notifications: OperationNotification[];
  summary: string;
}

export interface OperationNotification {
  id: string;
  storeId: string;
  section: string;
  title: string;
  message: string;
  recordId?: string | null;
  kind: string;
  createdAt: string;
  readAt?: string | null;
}

export interface OperationOptions {
  products: OperationProductOption[];
  clients: OperationClientOption[];
}

const baseUrl = () => {
  const value = getBackendBaseUrl();
  if (!value) throw new Error('Backend no configurado');
  return value.replace(/\/+$/, '');
};

async function headers(user: AuthUserLike, withBody = true) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function request<T>(user: AuthUserLike, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithTimeout(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...(await headers(user, init.body !== undefined)), ...init.headers },
  });
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error || `No se pudo guardar la operación (${response.status})`);
  if (!body) throw new Error('Respuesta inválida del servidor');
  return body;
}

export async function fetchOperationOptions(user: AuthUserLike, source: OperationSource) {
  return request<OperationOptions>(user, `/api/operations/${source}/options`, { method: 'GET' });
}

export async function fetchOperationDrafts(user: AuthUserLike, source: OperationSource) {
  return request<{ tradeIns: TradeIn[] }>(user, `/api/operations/${source}/drafts`, { method: 'GET' });
}

export async function createOperation(user: AuthUserLike, source: OperationSource, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/${source}`, { method: 'POST', body: JSON.stringify(input) });
}

export async function updateSaleOperation(user: AuthUserLike, id: string, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/sales/sales/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function updateTradeOperation(user: AuthUserLike, source: OperationSource, id: string, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function confirmTradeOperation(user: AuthUserLike, source: OperationSource, id: string, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}/confirm`, { method: 'POST', body: JSON.stringify(input) });
}

export async function cancelSaleOperation(user: AuthUserLike, id: string) {
  return request<OperationResult>(user, `/api/operations/sales/sales/${id}/cancel`, { method: 'POST', body: '{}' });
}

export async function cancelTradeOperation(user: AuthUserLike, source: OperationSource, id: string) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}/cancel`, { method: 'POST', body: '{}' });
}

export async function fetchSaleOperation(user: AuthUserLike, id: string) {
  return request<OperationResult>(user, `/api/operations/sales/sales/${id}`, { method: 'GET' });
}

export async function fetchTradeOperation(user: AuthUserLike, source: OperationSource, id: string) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}`, { method: 'GET' });
}

export async function fetchNotifications(user: AuthUserLike) {
  return request<{ notifications: OperationNotification[] }>(user, '/api/notifications', { method: 'GET' });
}

export async function markNotificationReadApi(user: AuthUserLike, id: string) {
  return request<{ id: string; readAt: string }>(user, `/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' });
}

export async function markAllNotificationsReadApi(user: AuthUserLike) {
  return request<{ count: number }>(user, '/api/notifications/read-all', { method: 'POST', body: '{}' });
}
