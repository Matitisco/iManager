import type { User } from 'firebase/auth';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type InvitationRole = 'ADMIN' | 'SELLER';
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
