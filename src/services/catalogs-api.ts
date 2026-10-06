import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export type CatalogKind =
  | 'INVENTORY_STATUS'
  | 'INVENTORY_CAPACITY'
  | 'INVENTORY_CONDITION'
  | 'SALE_STATUS'
  | 'TRADE_IN_STATUS';

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

async function headers(user: AuthUserLike) {
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function base() {
  const url = getBackendBaseUrl();
  if (!url) throw new Error('Backend no configurado');
  return url.replace(/\/+$/, '');
}

export async function fetchCatalogs(user: AuthUserLike): Promise<CatalogPayload> {
  const response = await fetchWithTimeout(`${base()}/api/catalogs`, { headers: await headers(user) });
  if (!response.ok) throw new Error('No se pudieron cargar los catálogos');
  return response.json() as Promise<CatalogPayload>;
}

export async function saveCatalog(
  user: AuthUserLike,
  kind: CatalogKind,
  body: { options: { value?: string; label: string; color?: string | null }[]; deletions: { value: string; reassignTo: string }[] },
): Promise<CatalogPayload> {
  const response = await fetchWithTimeout(`${base()}/api/catalogs/${kind}`, {
    method: 'PUT',
    headers: await headers(user),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'No se pudo guardar el catálogo');
  }
  return response.json() as Promise<CatalogPayload>;
}
