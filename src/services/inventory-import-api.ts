import type { AuthUserLike } from '../types/auth-user';
import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';

export interface ImportRow {
  imei: string;
  model: string;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: string;
  cost?: number;
  price: number;
  status?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: { row: number; imei: string; message: string }[];
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export async function importBackendInventoryItems(
  user: AuthUserLike,
  rows: ImportRow[]
): Promise<ImportResult> {
  const baseUrl = getBackendBaseUrl();
  if (!baseUrl) throw new Error('Backend no configurado');

  const token = await user.getIdToken();
  const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/api/inventory/import`, {
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

  return response.json() as Promise<ImportResult>;
}
