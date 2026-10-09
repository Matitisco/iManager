import type { AppSessionResponse } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { readApiErrorMessage } from '../lib/api-message';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

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

  return trimTrailingSlash(baseUrl);
}

export type OnboardingInput = {
  storeName: string;
  currency?: 'ARS' | 'USD';
  exchangeMode?: 'auto' | 'manual';
  exchangeSource?: 'blue' | 'oficial' | 'mep';
  manualBuy?: number | null;
  manualSell?: number | null;
};

export async function completeBackendOnboarding(user: AuthUserLike, input: OnboardingInput): Promise<AppSessionResponse> {
  const baseUrl = getBaseUrlOrThrow();
  const response = await fetchWithTimeout(`${baseUrl}/api/onboarding`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(readApiErrorMessage(body, `No se pudo completar el onboarding (${response.status})`));
  }

  const data = (await response.json()) as { session?: AppSessionResponse };
  if (!data.session) {
    throw new Error('Respuesta inválida al completar onboarding');
  }

  return data.session;
}
