import type { AppSession, AppSessionResponse, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { fetchWithTimeout } from './fetch-with-timeout';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const DEFAULT_BACKEND_ERROR_MESSAGE = 'El backend respondió con un error inesperado. Reintentando.';

function normalizeBackendErrorMessage(status: number, body: any) {
  const rawMessage = typeof body?.error === 'string' ? body.error.trim() : '';

  if (status >= 500) {
    return DEFAULT_BACKEND_ERROR_MESSAGE;
  }

  if (!rawMessage || rawMessage === 'Internal Server Error') {
    return `Backend respondió ${status}`;
  }

  return rawMessage;
}

export function getBackendBaseUrl() {
  const testBaseUrl = (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__;
  const baseUrl = testBaseUrl?.trim() || import.meta.env.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return null;
  return trimTrailingSlash(baseUrl);
}

export async function fetchBackendSession(user: AuthUserLike): Promise<{
  status: BackendConnectionStatus;
  session: AppSession | null;
  message: string | null;
}> {
  const baseUrl = getBackendBaseUrl();

  if (!baseUrl) {
    return {
      status: 'unconfigured',
      session: null,
      message: 'Backend no configurado. La app sigue funcionando con el flujo local actual.',
    };
  }

  try {
    const token = await user.getIdToken();

    const response = await fetchWithTimeout(`${baseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        status: 'error',
        session: null,
        message: normalizeBackendErrorMessage(response.status, body),
      };
    }

    const data = (await response.json()) as AppSessionResponse;

    return {
      status: 'ready',
      session: data,
      message: data.onboardingRequired
        ? 'El backend está activo, pero el usuario todavía no tiene una tienda/membresía asignada.'
        : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'offline',
      session: null,
      message: `No se pudo conectar al backend: ${message}`,
    };
  }
}
