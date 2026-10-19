import { analyticsDeviceHeader } from '../lib/analytics-device';
import { isInvalidAuthError } from '../lib/boot-cache';
import type { AppSession, AppSessionResponse, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { fetchWithTimeout } from './fetch-with-timeout';
import { toUserMessage } from '../lib/user-message';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
function normalizeBackendErrorMessage(status: number, body: unknown) {
  return toUserMessage({ ...(body && typeof body === 'object' ? body : {}), status }, 'No se pudo iniciar la sesión. Probá de nuevo.');
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

  let token: string;
  try {
    token = await user.getIdToken();
  } catch (error) {
    if (isInvalidAuthError(error)) {
      return {
        status: 'unauthorized',
        session: null,
        message: 'La sesión venció. Volvé a entrar.',
      };
    }
    return {
      status: 'offline',
      session: null,
      message: toUserMessage(error),
    };
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/me`, {
      headers: {
        'x-im-device': analyticsDeviceHeader(),
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 401) {
      return {
        status: 'unauthorized',
        session: null,
        message: 'La sesión venció. Volvé a entrar.',
      };
    }

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
    return {
      status: 'offline',
      session: null,
      message: toUserMessage(error),
    };
  }
}
