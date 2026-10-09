import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';
import type { AppStoreSummary, AppUserSummary } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';

async function getAuthHeaders(user: AuthUserLike) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function getBaseUrlOrThrow() {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) throw new Error('Backend no configurado');
  return baseUrl.replace(/\/+$/, '');
}

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
}

export async function updateStoreApi(user: AuthUserLike, data: StoreUpdateInput): Promise<AppStoreSummary> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/stores/current`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo guardar la tienda (${response.status})`);
  }

  const { store } = (await response.json()) as { store: AppStoreSummary };
  return store;
}

export async function updateUserProfileApi(user: AuthUserLike, data: { displayName: string }): Promise<AppUserSummary> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/users/me`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo guardar el perfil (${response.status})`);
  }

  const { user: updatedUser } = (await response.json()) as { user: AppUserSummary };
  return updatedUser;
}
