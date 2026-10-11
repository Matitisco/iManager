import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type CatalogKind =
  | 'INVENTORY_STATUS'
  | 'INVENTORY_CAPACITY'
  | 'INVENTORY_CONDITION'
  | 'SALE_STATUS'
  | 'TRADE_IN_STATUS'
  | 'CLIENT_TAG'
  | 'REPAIR_STATUS';

export interface CatalogOption {
  id: string;
  kind: CatalogKind;
  value: string;
  label: string;
  color: string | null;
  isSystem: boolean;
  sortOrder: number;
  count: number;
}

export interface CatalogPayload {
  meta: Record<CatalogKind, { title: string; add: string; noun: [string, string] }>;
  options: CatalogOption[];
}

export async function fetchCatalogs(user: AuthUserLike): Promise<CatalogPayload> {
  return apiRequest<CatalogPayload>(user, '/api/catalogs', {
    fallback: 'No se pudieron cargar los catálogos',
    errorFrom: 'fallback',
  });
}

export async function saveCatalog(
  user: AuthUserLike,
  kind: CatalogKind,
  body: { options: { value?: string; label: string; color?: string | null }[]; deletions: { value: string; reassignTo: string }[] },
): Promise<CatalogPayload> {
  return apiRequest<CatalogPayload>(user, `/api/catalogs/${kind}`, {
    method: 'PUT',
    body,
    fallback: 'No se pudo guardar el catálogo',
  });
}
