import type { ImportDiagnostics } from '../lib/import-diagnostics';
import { capture, deviceAdded } from '../lib/posthog-analytics';
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
  diagnostics?: ImportDiagnostics;
  missingRequiredFields?: string[];
  missingRecommendedFields?: string[];
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
    sheets: { name: string; rows: number; condition: string; included: boolean; diagnostics?: ImportDiagnostics }[];
  };
};

function captureAnalysis(section: ImportSection, phase: 'analyze' | 'apply', result: ImportAnalysis): void {
  // Older API deployments omit diagnostics. Never infer discarded counts from cell contents.
  const diagnostic = result.diagnostics;
  if (!diagnostic) return;
  capture('import_analysis_completed', {
    import_type: section, source: 'excel', phase,
    rows_detected: diagnostic.detectedRows, rows_prepared: diagnostic.acceptedRows,
    rows_imported: 0, rows_updated: 0, rows_discarded: diagnostic.discardedRows,
    discarded_by_reason: diagnostic.discardedByReason,
    missing_required_fields: diagnostic.missingRequiredFields,
    missing_recommended_fields: diagnostic.missingRecommendedFields,
  });
}

const ANALYZE_TIMEOUT_MS = 45_000;

export async function analyzeImport(
  user: AuthUserLike,
  section: ImportSection,
  sheets: ImportSheetPayload[],
): Promise<ImportAnalysis> {
  const result = await apiRequest<ImportAnalysis>(user, '/api/import/analyze', {
    method: 'POST',
    body: { section, sheets },
    fallback: 'No se pudo leer la planilla.',
    timeoutMs: ANALYZE_TIMEOUT_MS,
  });
  captureAnalysis(section, 'analyze', result);
  return result;
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
  const result = await apiRequest<ImportAnalysis>(user, '/api/import/apply', {
    method: 'POST',
    body: { section, sheets, plan, refreshMapping },
    fallback: 'No se pudo actualizar la importación.',
    timeoutMs: ANALYZE_TIMEOUT_MS,
  });
  captureAnalysis(section, 'apply', result);
  return result;
}

export interface InventoryImportRow {
  purchasedAt?: string;
  purchaseName?: string;
  imei: string;
  model: string;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: string;
  cost?: number;
  price: number | null;
  currency?: 'ARS' | 'USD';
  status?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportResult {
  diagnostics?: ImportDiagnostics;
  priceToDefine?: number;
  imported: number;
  updated: number;
  errors: { row: number; message: string; imei?: string }[];
}

export async function importBackendRows(
  user: AuthUserLike,
  section: ImportSection,
  rows: InventoryImportRow[] | Record<string, string>[],
  supplierId?: string,
  source: 'excel' | 'text' = 'excel',
): Promise<ImportResult> {
  try {
    if (section === 'inventory' && rows.some(row => row.price != null && typeof row.price === 'number' && !Number.isFinite(row.price))) {
      throw new Error('Revisá los precios inválidos del archivo o dejalos vacíos para definirlos después.');
    }
    const result = await apiRequest<ImportResult>(user, `/api/${section}/import`, {
      method: 'POST',
      body: supplierId ? { rows, supplierId } : { rows },
      fallback: (status) => `Error al importar (${status})`,
    });
    const saved = result.imported + result.updated;
    const diagnostic = result.diagnostics;
    capture('import_result', {
      import_type: section, source, phase: 'commit',
      rows_detected: diagnostic?.detectedRows ?? rows.length,
      rows_prepared: rows.length, rows_imported: result.imported, rows_updated: result.updated,
      rows_discarded: diagnostic?.discardedRows ?? result.errors.length,
      discarded_by_reason: diagnostic?.discardedByReason ?? {},
      missing_required_fields: diagnostic?.missingRequiredFields ?? [],
      missing_recommended_fields: diagnostic?.missingRecommendedFields ?? [],
    });
    if (source === 'excel' && saved > 0) capture('excel_import_succeeded', { rows: saved });
    if (source === 'excel' && result.errors.length) capture('excel_import_failed', { rows: result.errors.length });
    if (section === 'inventory' && result.imported > 0) deviceAdded();
    return result;
  } catch (error) {
    if (source === 'excel') capture('excel_import_failed', { rows: rows.length });
    throw error;
  }
}

export type TextProgressRow = { model: string; quantity: number };

/** Same #338 endpoint; NDJSON adds real chunk progress without saving anything. */
export async function analyzeInventoryTextProgress(
  user: AuthUserLike,
  text: string,
  onProgress: (rows: TextProgressRow[]) => void | Promise<void>,
  signal: AbortSignal,
): Promise<ImportAnalysis> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timeout = globalThis.setTimeout(abort, 190_000);
  try {
    return await apiRequest<ImportAnalysis>(user, "/api/import/analyze-text", {
      method: "POST",
      body: { text },
      accept: "application/x-ndjson",
      signal: controller.signal,
      timeoutMs: 190_000,
      fallback: "No se pudo analizar el listado.",
      readResponse: async (response) => {
        if (
          !response.headers
            .get("Content-Type")
            ?.includes("application/x-ndjson")
        )
          return response.json();
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No se recibió el análisis.");
        const decoder = new TextDecoder();
        let buffer = "";
        let result: ImportAnalysis | undefined;
        const consume = async (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as {
            type: string;
            rows: TextProgressRow[];
            analysis: ImportAnalysis;
            message: string;
          };
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "progress") await onProgress(event.rows);
          if (event.type === "result") result = event.analysis;
        };
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) await consume(line);
          }
          await consume(buffer + decoder.decode());
          if (!result)
            throw new Error("El análisis se interrumpió. Volvé a intentarlo.");
          return result;
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      },
    });
  } finally {
    globalThis.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
