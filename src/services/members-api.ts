import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';
import type { AuthUserLike } from '../types/auth-user';

export type MemberRole = 'OWNER' | 'MANAGER' | 'STAFF';

export interface TeamMember {
  id: string;
  userId: string;
  role: MemberRole;
  isDefault: boolean;
  createdAt: string;
  sections?: string[] | null;
  sensitiveAccess?: boolean | null;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

function getBaseUrl(): string {
  const url = getBackendBaseUrl();
  if (!url) throw new Error('Backend no configurado');
  return url.replace(/\/+$/, '');
}

async function authHeaders(user: AuthUserLike) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export async function listMembers(user: AuthUserLike, storeId: string): Promise<TeamMember[]> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/stores/${storeId}/members`, {
    headers: await authHeaders(user),
  });
  if (!res.ok) throw new Error('Error al cargar miembros');
  const data = await res.json();
  return data.members;
}

export async function updateMemberRole(
  user: AuthUserLike,
  storeId: string,
  memberId: string,
  role: MemberRole
): Promise<TeamMember> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/stores/${storeId}/members/${memberId}`, {
    method: 'PATCH',
    headers: await authHeaders(user),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error al cambiar rol');
  }
  const data = await res.json();
  return data.member;
}

export async function updateMemberSections(
  user: AuthUserLike,
  storeId: string,
  memberId: string,
  sections: string[],
  sensitiveAccess?: boolean | null,
): Promise<TeamMember> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/stores/${storeId}/members/${memberId}/sections`, {
    method: 'PATCH',
    headers: await authHeaders(user),
    body: JSON.stringify(sensitiveAccess === undefined ? { sections } : { sections, sensitiveAccess }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error al guardar los permisos');
  }
  const data = await res.json();
  return data.member;
}

export async function removeMember(user: AuthUserLike, storeId: string, memberId: string): Promise<void> {
  const res = await fetchWithTimeout(`${getBaseUrl()}/api/stores/${storeId}/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Error al remover miembro');
  }
}
