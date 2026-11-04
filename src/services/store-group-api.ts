import type { AppSession, StoreKind } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface GroupStore { id: string; name: string; kind: StoreKind; isCurrent: boolean }
export interface StoreGroup { id: string; name: string; stores: GroupStore[] }
export interface BalanceTotals { revenue: number; cost: number; grossProfit: number; expenses: number; netProfit: number }
export interface BalanceMonth { month: string; revenue: number; cost: number; expenses: number; netProfit: number }
export interface StoreBalance { storeId: string; name: string; kind: StoreKind; totals: BalanceTotals; monthly: BalanceMonth[] }
export interface GroupBalance {
  currency: string;
  mixedCurrency: boolean;
  months: string[];
  stores: StoreBalance[];
  combined: { totals: BalanceTotals; monthly: BalanceMonth[] } | null;
}
export interface StockTransfer {
  id: string; createdAt: string;
  from: { id: string; name: string }; to: { id: string; name: string };
  items: { label: string; quantity: number }[];
}
export interface TransferInput { toStoreId: string; items: { inventoryItemId: string; quantity?: number }[]; requestKey?: string }

export function fetchStoreGroup(user: AuthUserLike) {
  return apiRequest<{ group: StoreGroup | null }>(user, '/api/store-group', { fallback: 'No se pudieron cargar las tiendas.' });
}
export function enableStoreGroup(user: AuthUserLike, input: { currentKind: StoreKind; otherStoreName: string }) {
  return apiRequest<{ session: AppSession }>(user, '/api/store-group/enable', { method: 'POST', body: input, fallback: 'No se pudo activar multitienda.', errorFrom: 'friendly' });
}
export function activateStore(user: AuthUserLike, storeId: string) {
  return apiRequest<{ session: AppSession }>(user, '/api/stores/active', { method: 'POST', body: { storeId }, fallback: 'No se pudo cambiar de tienda.', errorFrom: 'friendly' });
}
export function fetchStoreGroupBalance(user: AuthUserLike, months: 3 | 6 | 12) {
  return apiRequest<GroupBalance>(user, `/api/store-group/balance?months=${months}`, { fallback: 'No se pudo cargar el balance.', errorFrom: 'friendly' });
}
export function transferStock(user: AuthUserLike, input: TransferInput) {
  return apiRequest<{ transfer: StockTransfer }>(user, '/api/store-group/transfers', { method: 'POST', body: input, fallback: 'No se pudo transferir el stock.', errorFrom: 'friendly' });
}
export function fetchStockTransfers(user: AuthUserLike, limit = 20) {
  return apiRequest<{ transfers: StockTransfer[] }>(user, `/api/store-group/transfers?limit=${limit}`, { fallback: 'No se pudieron cargar las transferencias.' });
}
