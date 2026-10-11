import type { AuthUserLike } from '../types/auth-user';
import { authorizedJson } from './authorized-json';

export interface TradeInImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importBackendTradeIns(
  user: AuthUserLike,
  rows: Record<string, string>[],
): Promise<TradeInImportResult> {
  return authorizedJson(user, '/api/trade-ins/import', { rows }, (status) => `Error al importar (${status})`);
}
