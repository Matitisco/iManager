import type { AuthUserLike } from '../types/auth-user';
import type { StoreActivityRange, StoreActivityResponse } from '../lib/store-activity';
import { apiRequest } from './api-client';

export async function fetchStoreActivity(user: AuthUserLike, range: StoreActivityRange): Promise<StoreActivityResponse> {
  const path = range === 'all' ? '/admin/store-activity?range=all' : '/admin/store-activity';
  return apiRequest<StoreActivityResponse>(user, path, {
    fallback: (status) => (status === 404 ? 'No encontrado' : 'No pudimos cargar la actividad.'),
    errorFrom: 'fallback',
  });
}
