import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export interface SupplierInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface SupplierListItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  deviceCount: number;
  problemCount: number;
  claimCount?: number;
  lastPurchasedAt?: string | null;
  deletedAt: string | null;
}

export interface SupplierPurchaseItem {
  id: string;
  model: string;
  capacity: string;
  imei: string;
  status: string;
  cost?: number;
  currency: string | null;
  problem: boolean;
  problemLabel: string | null;
  createdAt: string;
}

export interface SupplierPurchase {
  id: string;
  name: string | null;
  purchasedAt: string;
  notes: string | null;
  devices: number;
  problemCount: number;
  claimCount: number;
  totalCost?: number | null;
  currency?: string | null;
  costTotals?: Array<{ currency: string; totalCost: number }>;
}

export interface SupplierPurchaseDetail extends SupplierPurchase {
  items: SupplierPurchaseItem[];
  summary: { devices: number; problems: number };
}

export interface SupplierDetail extends SupplierListItem {
  stockCount?: number;
  claimedDeviceCount?: number;
  costTotals?: Array<{ currency: string; totalCost: number }>;
  purchases: SupplierPurchase[];
}

export function fetchSuppliers(user: AuthUserLike, archived = false) {
  const query = archived ? '?archived=1' : '';
  return apiRequest<{ suppliers: SupplierListItem[] }>(user, `/api/suppliers${query}`, {
    fallback: 'No se pudieron cargar los proveedores',
  }).then((data) => data.suppliers);
}

export function fetchSupplier(user: AuthUserLike, id: string) {
  return apiRequest<{ supplier: SupplierDetail }>(user, `/api/suppliers/${id}?includeItems=0`, {
    fallback: 'No se pudo abrir el proveedor',
    errorFrom: 'friendly',
  }).then((data) => data.supplier);
}

export function fetchSupplierPurchase(user: AuthUserLike, id: string, purchaseId: string) {
  return apiRequest<{ purchase: SupplierPurchaseDetail }>(user, `/api/suppliers/${id}/purchases/${purchaseId}`, {
    fallback: 'No se pudo abrir la compra',
    errorFrom: 'friendly',
  }).then((data) => data.purchase);
}

export function createSupplier(user: AuthUserLike, input: SupplierInput) {
  return apiRequest<{ supplier: SupplierListItem }>(user, '/api/suppliers', {
    method: 'POST',
    body: input,
    fallback: 'No se pudo guardar el proveedor',
    errorFrom: 'friendly',
  }).then((data) => data.supplier);
}

export function updateSupplier(user: AuthUserLike, id: string, input: SupplierInput) {
  return apiRequest<{ supplier: SupplierListItem }>(user, `/api/suppliers/${id}`, {
    method: 'PATCH',
    body: input,
    fallback: 'No se pudo guardar el proveedor',
    errorFrom: 'friendly',
  }).then((data) => data.supplier);
}

export function archiveSupplier(user: AuthUserLike, id: string, reason?: string) {
  return apiRequest<void>(user, `/api/suppliers/${id}`, {
    method: 'DELETE',
    body: { reason },
    fallback: 'No se pudo archivar el proveedor',
    errorFrom: 'friendly',
  });
}

export function restoreSupplier(user: AuthUserLike, id: string) {
  return apiRequest<{ supplier: SupplierListItem }>(user, `/api/suppliers/${id}/restore`, {
    method: 'POST',
    fallback: 'No se pudo restaurar el proveedor',
    errorFrom: 'friendly',
  }).then((data) => data.supplier);
}
