import type { AuthUserLike } from '../types/auth-user';
import { readApiErrorMessage } from '../lib/api-message';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  fallback: string | ((status: number) => string);
  // 'error' shows the backend `error` field, 'friendly' also reads `message`/`fields`
  // and hides technical text, 'fallback' never shows the backend text.
  errorFrom?: 'error' | 'friendly' | 'fallback';
  timeoutMs?: number;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(user: AuthUserLike, path: string, options: ApiRequestOptions): Promise<T> {
  const { method = 'GET', body, fallback, errorFrom = 'error', timeoutMs } = options;
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) throw new Error('Backend no configurado');

  const token = await user.getIdToken();
  const hasBody = body !== undefined;
  const init: RequestInit = {
    method,
    // Fastify rejects an empty body sent with Content-Type: application/json.
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  };
  const response = timeoutMs === undefined
    ? await fetchWithTimeout(`${baseUrl}${path}`, init)
    : await fetchWithTimeout(`${baseUrl}${path}`, init, timeoutMs);

  if (!response.ok) {
    const message = typeof fallback === 'function' ? fallback(response.status) : fallback;
    if (errorFrom === 'fallback') throw new ApiError(response.status, message);
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, errorFrom === 'friendly' ? readApiErrorMessage(payload, message) : payload?.error || message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
