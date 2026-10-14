import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from './api-client';

export type ImportSection = 'inventory' | 'sales' | 'clients' | 'trade-ins';

export type ImportSheetPayload = {
  name: string;
  rows: string[][];
};

export type ImportColumnMapping = {
  header: string;
  field: string;
};

export type ImportSheetPlan = {
  name: string;
  include: boolean;
  condition: '' | 'NUEVO' | 'USADO' | 'PRE-OWNED';
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  mapping: ImportColumnMapping[];
  splitModelCapacity: boolean;
  batteryAsPercent: boolean;
  priceCurrency: '' | 'ARS' | 'USD';
};

export type ImportAnalysis = {
  review?: { line: number; original: string; dudas: string[] }[];
  discarded?: { line: number; original: string; reason: string }[];
  source: 'model' | 'heuristic' | 'manual';
  notice: string | null;
  currency: 'ARS' | 'USD';
  plan: ImportSheetPlan[];
  rows: Record<string, string>[];
  summary: {
    sheetCount: number;
    rowCount: number;
    sheets: { name: string; rows: number; condition: string; included: boolean }[];
  };
};

const ANALYZE_TIMEOUT_MS = 45_000;

export async function analyzeImport(
  user: AuthUserLike,
  section: ImportSection,
  sheets: ImportSheetPayload[],
): Promise<ImportAnalysis> {
  return apiRequest<ImportAnalysis>(user, '/api/import/analyze', {
    method: 'POST',
    body: { section, sheets },
    fallback: 'No se pudo leer la planilla.',
    timeoutMs: ANALYZE_TIMEOUT_MS,
  });
}

export async function analyzeInventoryText(user: AuthUserLike, text: string): Promise<ImportAnalysis> {
  return apiRequest<ImportAnalysis>(user, '/api/import/analyze-text', {
    method: 'POST', body: { text },
    fallback: 'No se pudo analizar el listado. Probá de nuevo.', timeoutMs: 190_000,
  });
}

export async function applyImportPlan(
  user: AuthUserLike,
  section: ImportSection,
  sheets: ImportSheetPayload[],
  plan: ImportSheetPlan[],
  refreshMapping = false,
): Promise<ImportAnalysis> {
  return apiRequest<ImportAnalysis>(user, '/api/import/apply', {
    method: 'POST',
    body: { section, sheets, plan, refreshMapping },
    fallback: 'No se pudo actualizar la importación.',
    timeoutMs: ANALYZE_TIMEOUT_MS,
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
  currency?: 'ARS' | 'USD';
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
