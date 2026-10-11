import type { AppSessionResponse } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type OnboardingInput = {
  storeName: string;
  instagram: string;
  currency?: 'ARS' | 'USD';
  exchangeMode?: 'auto' | 'manual';
  exchangeSource?: 'blue' | 'oficial' | 'mep';
  manualBuy?: number | null;
  manualSell?: number | null;
};

export async function completeBackendOnboarding(user: AuthUserLike, input: OnboardingInput): Promise<AppSessionResponse> {
  const data = await apiRequest<{ session?: AppSessionResponse }>(user, '/api/onboarding', {
    method: 'POST',
    body: input,
    fallback: (status) => `No se pudo completar el onboarding (${status})`,
    errorFrom: 'friendly',
  });
  if (!data.session) {
    throw new Error('Respuesta inválida al completar onboarding');
  }

  return data.session;
}
