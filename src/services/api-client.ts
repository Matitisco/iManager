import type { AuthUserLike } from '../types/auth-user';
import { readApiErrorMessage } from '../lib/api-message';
import { SERVER_ERROR_MESSAGE, toUserMessage } from '../lib/user-message';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  fallback: string | ((status: number) => string);
  // 'error'/'friendly' read backend validation text and hide technical messages;
  // 'fallback' never shows backend text. All modes normalize 5xx errors.
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
  try {
    return await performRequest<T>(user, path, options);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Token acquisition and response parsing can also reject with SDK/browser text.
    const friendlyError = new Error(toUserMessage(error), { cause: error });
    if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') friendlyError.name = error.name;
    throw friendlyError;
  }
}

async function performRequest<T>(user: AuthUserLike, path: string, options: ApiRequestOptions): Promise<T> {
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
    if (response.status >= 500) throw new ApiError(response.status, SERVER_ERROR_MESSAGE);
    const message = typeof fallback === 'function' ? fallback(response.status) : fallback;
    if (errorFrom === 'fallback') throw new ApiError(response.status, message);
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, toUserMessage({ status: response.status, message: readApiErrorMessage(payload, message) }, message));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
