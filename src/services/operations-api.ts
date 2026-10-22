import type { Client, OperationClientOption, OperationProductOption, Product, Sale, TradeIn } from '../types';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type OperationSource = 'inventory' | 'sales' | 'tradeins' | 'clients';
export type OperationSaleStatus = 'COMPLETADA' | 'PENDIENTE';

export interface OperationInput {
  depositIds?: string[];
  creditNoteIds?: string[];
  sellerMemberId?: string | null;
  exchangeRate?: number;
  date?: string;
  clientId?: string | null;
  clientName?: string;
  productId?: string | null;
  deviceLabel?: string;
  amount?: number;
  currency?: 'ARS' | 'USD' | null;
  warrantyDays?: number;
  unlistedEquipment?: {
    model: string;
    capacity?: string;
    color?: string;
    condition?: string;
    imei?: string | null;
    price?: number;
  };
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
  } | null;
  tenders?: Array<{ amount: number; currency: 'ARS' | 'USD'; method: string; exchangeRate?: number | null }>;
  excess?: 'OMIT' | 'CREDIT' | 'CHANGE';
  changeMethod?: string;
  installments?: {
    count: number;
    frequency: 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';
    firstDueDate: string;
    surcharge?: number;
    collectFirstNow?: boolean;
    firstMethod?: string;
  } | null;
}

export interface OperationResult {
  sale?: Sale;
  tradeIn?: TradeIn;
  inventory: Product[];
  clients: Client[];
  notifications: OperationNotification[];
  summary: string;
}

export interface OperationNoticeTarget {
  recordId: string;
  reason: string;
}

export interface OperationNotification {
  id: string;
  storeId: string;
  section: string;
  title: string;
  message: string;
  recordId?: string | null;
  targets?: OperationNoticeTarget[] | null;
  kind: string;
  createdAt: string;
  readAt?: string | null;
}

export interface OperationOptions {
  products: OperationProductOption[];
  clients: OperationClientOption[];
}

async function request<T>(user: AuthUserLike, path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
  return apiRequest<T>(user, path, {
    method,
    body,
    fallback: (status) => `No se pudo guardar la operación (${status})`,
  });
}

export async function fetchOperationOptions(user: AuthUserLike, source: OperationSource) {
  return request<OperationOptions>(user, `/api/operations/${source}/options`);
}

export async function fetchOperationDrafts(user: AuthUserLike, source: OperationSource) {
  return request<{ tradeIns: TradeIn[] }>(user, `/api/operations/${source}/drafts`);
}

export async function createOperation(user: AuthUserLike, source: OperationSource, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/${source}`, 'POST', input);
}

export async function updateSaleOperation(user: AuthUserLike, id: string, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/sales/sales/${id}`, 'PATCH', input);
}

export async function updateTradeOperation(user: AuthUserLike, source: OperationSource, id: string, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}`, 'PATCH', input);
}

export async function confirmTradeOperation(user: AuthUserLike, source: OperationSource, id: string, input: OperationInput) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}/confirm`, 'POST', input);
}

export async function cancelSaleOperation(user: AuthUserLike, id: string, reason?: string) {
  return request<OperationResult>(user, `/api/operations/sales/sales/${id}/cancel`, 'POST', reason == null ? {} : { reason });
}

export async function cancelTradeOperation(user: AuthUserLike, source: OperationSource, id: string, reason?: string) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}/cancel`, 'POST', reason == null ? {} : { reason });
}

export async function fetchSaleOperation(user: AuthUserLike, id: string) {
  return request<OperationResult>(user, `/api/operations/sales/sales/${id}`);
}

export async function fetchTradeOperation(user: AuthUserLike, source: OperationSource, id: string) {
  return request<OperationResult>(user, `/api/operations/${source}/trades/${id}`);
}

export async function fetchNotifications(user: AuthUserLike) {
  return request<{ notifications: OperationNotification[] }>(user, '/api/notifications');
}

export async function markNotificationReadApi(user: AuthUserLike, id: string) {
  return request<{ id: string; readAt: string }>(user, `/api/notifications/${encodeURIComponent(id)}/read`, 'POST', {});
}

export async function markAllNotificationsReadApi(user: AuthUserLike) {
  return request<{ count: number }>(user, '/api/notifications/read-all', 'POST', {});
}
