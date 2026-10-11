import type { AuthUserLike } from '../types/auth-user';
import type { ColumnSuggestion } from '../lib/import-mapping';
import { apiRequest } from './api-client';

export type ImportSection = 'inventory' | 'sales' | 'clients' | 'trade-ins';

export type SuggestMappingResponse = {
  source: 'decisions' | 'heuristic';
  notice: string | null;
  suggestions: ColumnSuggestion[];
};

const SUGGEST_TIMEOUT_MS = 60_000;

export async function suggestImportMapping(
  user: AuthUserLike,
  section: ImportSection,
  columns: { header: string; samples: string[] }[],
): Promise<SuggestMappingResponse> {
  return apiRequest<SuggestMappingResponse>(user, '/api/import/suggest-mapping', {
    method: 'POST',
    body: { section, columns },
    fallback: 'No se pudo consultar el mapeo inteligente. Usamos el mapeo por nombre de columna.',
    timeoutMs: SUGGEST_TIMEOUT_MS,
  });
}

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
