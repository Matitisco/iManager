import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';
import { apiRequest } from './api-client';
import type { AppSession } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import { toUserMessage } from '../lib/user-message';

export type InvitationRole = 'MANAGER' | 'STAFF';
export interface Invitation {
  id: string;
  email?: string;
  role: InvitationRole;
  createdAt: string;
  expiresAt: string;
}

export interface CreatedInvitation extends Invitation {
  token: string;
  inviteUrl: string;
}

export interface InvitationPreview {
  storeName: string;
  role: InvitationRole | 'OWNER';
}

export type InvitationPreviewResolution =
  | { kind: 'valid'; preview: InvitationPreview; attempts: number }
  | { kind: 'invalid'; attempts: number }
  | { kind: 'error'; message: string; attempts: number };

interface ResolveInvitationPreviewOptions {
  fetcher?: typeof fetchWithTimeout;
  retries?: number;
  retryDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_PREVIEW_ERROR_MESSAGE = 'Error al verificar invitación';
const DEFAULT_PREVIEW_RETRIES = 2;
const DEFAULT_PREVIEW_RETRY_DELAY_MS = 1200;

function getBaseUrl(): string {
  const url = getBackendBaseUrl();
  if (!url) throw new Error('Backend no configurado');
  return url.replace(/\/+$/, '');
}

function shouldRetryPreview(error: unknown): boolean {
  if (error instanceof Error) {
    return ['AbortError', 'TimeoutError', 'TypeError', 'NetworkError'].includes(error.name);
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string' && ['AbortError', 'TimeoutError', 'TypeError', 'NetworkError'].includes(error.name)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export async function createInvitation(
  user: AuthUserLike,
  email: string | undefined,
  role: InvitationRole
): Promise<CreatedInvitation> {
  return apiRequest<CreatedInvitation>(user, '/api/invitations', {
    method: 'POST',
    body: email ? { email, role } : { role },
    fallback: 'Error al crear invitación',
  });
}

export async function listInvitations(user: AuthUserLike): Promise<Invitation[]> {
  const data = await apiRequest<{ invitations: Invitation[] }>(user, '/api/invitations', {
    fallback: 'Error al cargar invitaciones',
    errorFrom: 'fallback',
  });
  return data.invitations;
}

export async function revokeInvitation(user: AuthUserLike, invitationId: string): Promise<void> {
  await apiRequest<void>(user, `/api/invitations/${invitationId}`, {
    method: 'DELETE',
    fallback: 'Error al revocar invitación',
  });
}

export async function resolveInvitationPreview(
  token: string,
  options: ResolveInvitationPreviewOptions = {}
): Promise<InvitationPreviewResolution> {
  const {
    fetcher = fetchWithTimeout,
    retries = DEFAULT_PREVIEW_RETRIES,
    retryDelayMs = DEFAULT_PREVIEW_RETRY_DELAY_MS,
    onRetry,
  } = options;

  const url = `${getBaseUrl()}/api/invitations/preview/${token}`;
  let attempts = 0;
  let lastError: unknown = null;

  while (attempts <= retries) {
    attempts += 1;

    try {
      const res = await fetcher(url);

      if (res.status === 410 || res.status === 404) {
        return { kind: 'invalid', attempts };
      }

      if (res.ok) {
        return {
          kind: 'valid',
          preview: (await res.json()) as InvitationPreview,
          attempts,
        };
      }

      if (res.status >= 500 && attempts <= retries) {
        lastError = { status: res.status };
        onRetry?.(attempts, lastError);
        await wait(retryDelayMs);
        continue;
      }

      return {
        kind: 'error',
        message: toUserMessage({ status: res.status }, DEFAULT_PREVIEW_ERROR_MESSAGE),
        attempts,
      };
    } catch (error) {
      lastError = error;

      if (attempts <= retries && shouldRetryPreview(error)) {
        onRetry?.(attempts, error);
        await wait(retryDelayMs);
        continue;
      }

      return {
        kind: 'error',
        message: toUserMessage(error, DEFAULT_PREVIEW_ERROR_MESSAGE),
        attempts,
      };
    }
  }

  return {
    kind: 'error',
    message: toUserMessage(lastError, DEFAULT_PREVIEW_ERROR_MESSAGE),
    attempts,
  };
}

export async function acceptInvitation(user: AuthUserLike, token: string) {
  return apiRequest<{ session: AppSession }>(user, '/api/invitations/accept', {
    method: 'POST',
    body: { token },
    fallback: 'Error al aceptar invitación',
  });
}
