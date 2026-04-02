import type { User } from 'firebase/auth';
import type { AppSessionResponse } from '../types/app-session';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

async function getAuthHeaders(user: User) {
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

  return trimTrailingSlash(baseUrl);
}

export async function completeBackendOnboarding(user: User, storeName: string): Promise<AppSessionResponse> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/onboarding`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ storeName }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `No se pudo completar el onboarding (${response.status})`);
  }

  const data = (await response.json()) as { session?: AppSessionResponse };
  if (!data.session) {
    throw new Error('Respuesta inválida al completar onboarding');
  }

  return data.session;
}
