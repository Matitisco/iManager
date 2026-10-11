import type { AuthUserLike } from '../types/auth-user';
import { authorizedJson } from './authorized-json';

export interface SaleImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importBackendSales(
  user: AuthUserLike,
  rows: Record<string, string>[],
): Promise<SaleImportResult> {
  return authorizedJson(user, '/api/sales/import', { rows }, (status) => `Error al importar (${status})`);
}
