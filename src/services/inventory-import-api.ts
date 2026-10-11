import type { AuthUserLike } from '../types/auth-user';
import { authorizedJson } from './authorized-json';

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

export async function importBackendInventoryItems(
  user: AuthUserLike,
  rows: ImportRow[],
): Promise<ImportResult> {
  return authorizedJson(user, '/api/inventory/import', { rows }, (status) => `Error al importar (${status})`);
}
