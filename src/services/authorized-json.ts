import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export async function authorizedJson<T>(
  user: AuthUserLike,
  path: string,
  body: unknown,
  fallback: (status: number) => string,
): Promise<T> {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) throw new Error('Backend no configurado');

  const token = await user.getIdToken();
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || fallback(response.status));
  }

  return response.json() as Promise<T>;
}
