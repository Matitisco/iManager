import { apiRequest } from './api-client';
import type { AppStoreSummary, AppUserSummary } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';

export interface StoreUpdateInput {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  address?: string | null;
  currency?: string;
  exchangeMode?: 'auto' | 'manual';
  exchangeSource?: 'blue' | 'oficial' | 'mep';
  manualBuy?: number | null;
  manualSell?: number | null;
  timezone?: string;
  usedWarrantyDays?: number;
  sealedWarrantyDays?: number;
  repairWarrantyDays?: number;
}

export async function updateStoreApi(user: AuthUserLike, data: StoreUpdateInput): Promise<AppStoreSummary> {
  const { store } = await apiRequest<{ store: AppStoreSummary }>(user, '/api/stores/current', {
    method: 'PATCH',
    body: data,
    fallback: (status) => `No se pudo guardar la tienda (${status})`,
  });
  return store;
}

export async function updateUserProfileApi(user: AuthUserLike, data: { displayName: string }): Promise<AppUserSummary> {
  const { user: updatedUser } = await apiRequest<{ user: AppUserSummary }>(user, '/api/users/me', {
    method: 'PATCH',
    body: data,
    fallback: (status) => `No se pudo guardar el perfil (${status})`,
  });
  return updatedUser;
}
