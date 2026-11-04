import type { AuthUserLike } from '../types/auth-user';
import { ApiError, apiRequest } from './api-client';

export const PERMANENT_DELETE_PATHS = {
  eq: '/api/inventory', sale: '/api/sales', cl: '/api/clients', cj: '/api/trade-ins', ot: '/api/repairs',
} as const;
export type PermanentDeleteKind = keyof typeof PERMANENT_DELETE_PATHS;

export function permanentDeleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'No encontramos este registro: puede que ya se haya borrado. Actualizá la pantalla.';
    if (error.status === 403) return 'Solo el dueño de la tienda puede borrar definitivamente.';
    if (error.status === 409) return 'Primero anulá o archivá el registro para poder borrarlo.';
  }
  return 'No se pudo borrar. Revisá tu conexión y reintentá.';
}

export function permanentlyDeleteBackendRecord(user: AuthUserLike, kind: PermanentDeleteKind, id: string) {
  return apiRequest<void>(user, `${PERMANENT_DELETE_PATHS[kind]}/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE', fallback: 'No se pudo borrar definitivamente el registro.',
  });
}
