import { apiRequest } from './api-client';
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

export async function listMembers(user: AuthUserLike, storeId: string): Promise<TeamMember[]> {
  const data = await apiRequest<{ members: TeamMember[] }>(user, `/api/stores/${storeId}/members`, {
    fallback: 'Error al cargar miembros',
    errorFrom: 'fallback',
  });
  return data.members;
}

export async function updateMemberSections(
  user: AuthUserLike,
  storeId: string,
  memberId: string,
  sections: string[],
  sensitiveAccess?: boolean | null,
): Promise<TeamMember> {
  const data = await apiRequest<{ member: TeamMember }>(user, `/api/stores/${storeId}/members/${memberId}/sections`, {
    method: 'PATCH',
    body: sensitiveAccess === undefined ? { sections } : { sections, sensitiveAccess },
    fallback: 'Error al guardar los permisos',
  });
  return data.member;
}
