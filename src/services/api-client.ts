import { analyticsDeviceHeader } from '../lib/analytics-device';
import type { AuthUserLike } from '../types/auth-user';
import { isTechnicalMessage, readApiErrorMessage } from '../lib/api-message';
import { SERVER_ERROR_MESSAGE, toUserMessage } from '../lib/user-message';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type ApiRequestOptions = {
  keepalive?: boolean;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  fallback: string | ((status: number) => string);
  // 'error'/'friendly' read backend validation text and hide technical messages;
  // 'fallback' never shows backend text. All modes normalize 5xx errors.
  errorFrom?: 'error' | 'friendly' | 'fallback';
  // A 503 from billing can carry a safe Spanish sentence. Other 5xx stay generic.
  revealFriendlyServerError?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  accept?: string;
  readResponse?: (response: Response) => Promise<unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown> | null;

  constructor(status: number, message: string, payload: Record<string, unknown> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function archivedMatchOf(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const id = error.payload?.archivedMatchId;
  if (error.payload?.code !== 'ARCHIVED_MATCH' || typeof id !== 'string') return null;
  return { id, entity: String(error.payload.entity ?? ''), message: error.message };
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
    ...(options.keepalive ? { keepalive: true } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    cache: 'no-store',
    // Fastify rejects an empty body sent with Content-Type: application/json.
    headers: {
      'x-im-device': analyticsDeviceHeader(),
      Authorization: `Bearer ${token}`,
      Accept: options.accept ?? 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  };
  const response = timeoutMs === undefined
    ? await fetchWithTimeout(`${baseUrl}${path}`, init)
    : await fetchWithTimeout(`${baseUrl}${path}`, init, timeoutMs);

  if (!response.ok) {
    if (response.status >= 500) {
      if (options.revealFriendlyServerError) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        const text = typeof payload?.error === 'string' ? payload.error.trim() : '';
        if (text && text.length <= 240 && !isTechnicalMessage(text)) throw new ApiError(response.status, text);
      }
      throw new ApiError(response.status, SERVER_ERROR_MESSAGE);
    }
    const message = typeof fallback === 'function' ? fallback(response.status) : fallback;
    if (errorFrom === 'fallback') throw new ApiError(response.status, message);
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, toUserMessage({ status: response.status, message: readApiErrorMessage(payload, message) }, message), payload && typeof payload === 'object' ? payload as Record<string, unknown> : null);
  }

  if (response.status === 204) return undefined as T;
  return (options.readResponse ? options.readResponse(response) : response.json()) as Promise<T>;
}
