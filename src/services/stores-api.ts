import type { AppSessionResponse } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

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
  if (!baseUrl) {
    throw new Error('Backend no configurado');
  }
  return baseUrl.replace(/\/+$/, '');
}

async function readSession(response: Response, fallback: string): Promise<AppSessionResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || fallback);
  }

  const data = (await response.json()) as { session?: AppSessionResponse };
  if (!data.session) {
    throw new Error('Respuesta inválida de tiendas');
  }

  return data.session;
}

export async function createOwnedStore(user: AuthUserLike, name: string): Promise<AppSessionResponse> {
  const response = await fetchWithTimeout(`${getBaseUrlOrThrow()}/api/stores`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ name }),
  });

  return readSession(response, 'No se pudo crear la tienda');
}

export async function activateStore(user: AuthUserLike, storeId: string): Promise<AppSessionResponse> {
  const response = await fetchWithTimeout(`${getBaseUrlOrThrow()}/api/stores/active`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ storeId }),
  });

  return readSession(response, 'No se pudo cambiar de tienda');
}
