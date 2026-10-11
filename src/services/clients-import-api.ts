import type { AuthUserLike } from '../types/auth-user';
import { authorizedJson } from './authorized-json';

export interface ClientImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export async function importBackendClients(
  user: AuthUserLike,
  rows: Record<string, string>[],
): Promise<ClientImportResult> {
  return authorizedJson(user, '/api/clients/import', { rows }, (status) => `Error al importar (${status})`);
}
