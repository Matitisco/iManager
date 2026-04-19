import type { User } from 'firebase/auth';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type InvitationRole = 'MANAGER' | 'STAFF';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

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

async function authHeaders(user: User) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return DEFAULT_PREVIEW_ERROR_MESSAGE;
}

function shouldRetryPreview(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TypeError');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export async function createInvitation(
  user: User,
  email: string | undefined,
  role: InvitationRole
): Promise<CreatedInvitation> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/invitations`, {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify(email ? { email, role } : { role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error al crear invitación');
  }
  return res.json();
}

export async function listInvitations(user: User): Promise<Invitation[]> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/invitations`, {
    headers: await authHeaders(user),
  });
  if (!res.ok) throw new Error('Error al cargar invitaciones');
  const data = await res.json();
  return data.invitations;
}

export async function revokeInvitation(user: User, invitationId: string): Promise<void> {
  const token = await user.getIdToken();
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/invitations/${invitationId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error al revocar invitación');
  }
}

export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/invitations/preview/${token}`);
  if (res.status === 410 || res.status === 404) return null;
  if (!res.ok) throw new Error('Error al verificar invitación');
  return res.json();
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
        lastError = new Error(DEFAULT_PREVIEW_ERROR_MESSAGE);
        onRetry?.(attempts, lastError);
        await wait(retryDelayMs);
        continue;
      }

      return {
        kind: 'error',
        message: DEFAULT_PREVIEW_ERROR_MESSAGE,
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
        message: getErrorMessage(error),
        attempts,
      };
    }
  }

  return {
    kind: 'error',
    message: getErrorMessage(lastError),
    attempts,
  };
}

export async function acceptInvitation(user: User, token: string) {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/invitations/accept`, {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error al aceptar invitación');
  }
  return res.json();
}
