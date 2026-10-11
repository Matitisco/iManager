import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type ImportSection = 'inventory' | 'sales' | 'clients' | 'trade-ins';

export interface InventoryImportRow {
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
  errors: { row: number; message: string; imei?: string }[];
}

export async function importBackendRows(
  user: AuthUserLike,
  section: ImportSection,
  rows: InventoryImportRow[] | Record<string, string>[],
): Promise<ImportResult> {
  return apiRequest<ImportResult>(user, `/api/${section}/import`, {
    method: 'POST',
    body: { rows },
    fallback: (status) => `Error al importar (${status})`,
  });
}
