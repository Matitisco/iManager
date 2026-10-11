import type { AuthUserLike } from '../types/auth-user';
import type { ColumnSuggestion } from '../lib/import-mapping';
import { apiRequest } from './api-client';

export type ImportSection = 'inventory' | 'sales' | 'clients' | 'trade-ins';

export type SuggestMappingResponse = {
  source: 'decisions' | 'heuristic';
  notice: string | null;
  suggestions: ColumnSuggestion[];
};

export type DetectedSheet = {
  name: string;
  include: boolean;
  headerRow: number;
  condition: string | null;
  headers: string[];
  mapping: Record<string, string>;
  rows: Record<string, string>[];
};

export type DetectImportResponse = {
  source: 'responses' | 'heuristic';
  notice: string | null;
  sheets: DetectedSheet[];
  totals: { sheets: number; rows: number };
};

export type DetectImportRequest = {
  currency?: 'ARS' | 'USD';
  sellRate?: number | null;
  sheets: { name: string; rows: string[][] }[];
  overrides?: {
    name: string;
    include: boolean;
    headerRow: number;
    mapping?: Record<string, string>;
  }[];
};

const SUGGEST_TIMEOUT_MS = 60_000;

const DETECT_TIMEOUT_MS = 60_000;

export async function detectImport(
  user: AuthUserLike,
  section: ImportSection,
  input: DetectImportRequest,
): Promise<DetectImportResponse> {
  return apiRequest<DetectImportResponse>(user, '/api/import/detect', {
    method: 'POST',
    body: { section, ...input },
    fallback: 'No se pudo leer el archivo. Probá de nuevo.',
    timeoutMs: DETECT_TIMEOUT_MS,
  });
}

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
