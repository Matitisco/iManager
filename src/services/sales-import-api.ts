import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export interface SaleImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

const trimSlash = (v: string) => v.replace(/\/+$/, '');

export async function importBackendSales(
  user: AuthUserLike,
  rows: Record<string, string>[]
): Promise<SaleImportResult> {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) throw new Error('Backend no configurado');

  const token = await user.getIdToken();
  const response = await fetchWithTimeout(`${trimSlash(baseUrl)}/api/sales/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error al importar (${response.status})`);
  }

  return response.json() as Promise<SaleImportResult>;
}
