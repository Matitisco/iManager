import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export const PERMANENT_DELETE_PATHS = {
  eq: '/inventory', sale: '/sales', cl: '/clients', cj: '/trade-ins', ot: '/repairs',
} as const;
export type PermanentDeleteKind = keyof typeof PERMANENT_DELETE_PATHS;

export function permanentlyDeleteBackendRecord(user: AuthUserLike, kind: PermanentDeleteKind, id: string) {
  return apiRequest<void>(user, `${PERMANENT_DELETE_PATHS[kind]}/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE', fallback: 'No se pudo borrar definitivamente el registro.',
  });
}
