import { apiRequest } from './api-client';
import type { AuthUserLike } from '../types/auth-user';

export type ViewSection = 'inventory' | 'sales' | 'tradeins' | 'clients';
export type RecordVersion = { id: string; updatedAt: string };
export type SectionChanges = Partial<Record<ViewSection, RecordVersion[]>>;

export function fetchSectionChanges(user: AuthUserLike) {
  return apiRequest<{ sections: SectionChanges }>(user, '/api/section-views', { fallback: 'No se pudieron cargar las novedades.' });
}

export function markSectionViewed(user: AuthUserLike, section: ViewSection, versions: RecordVersion[]) {
  return apiRequest<{ viewed: RecordVersion[] }>(user, `/api/section-views/${section}`, {
    method: 'POST', body: { versions }, fallback: 'No se pudieron guardar las novedades vistas.',
  });
}
