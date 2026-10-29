import type { CustomFieldInput } from './custom-fields-api';
import type { ImportDiagnostics } from '../lib/import-diagnostics';
import { capture, deviceAdded } from '../lib/posthog-analytics';
import type { AuthUserLike } from '../types/auth-user';
import { apiRequest, ApiError } from './api-client';
import { prepareImportSheets } from '../utils/import-limits';

export type ImportSection = 'inventory' | 'sales' | 'clients' | 'trade-ins';

export type ImportSheetPayload = {
  name: string;
  rows: string[][];
};

export type ImportColumnMapping = {
  review?: string[];
  header: string;
  columnIndex?: number;
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
  warnings?: string[];
  suggestedDefinitions?: CustomFieldInput[];
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

export function importErrorMessage(error: unknown, phase: 'analyze' | 'import'): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return 'El archivo es demasiado grande. Dividilo en partes e intentá de nuevo.';
    if (error.status === 400 && error.message.startsWith('No se importó ningún equipo.')) return error.message;
    if (error.status === 400) return phase === 'analyze'
      ? 'No se pudo leer la planilla. Revisá las hojas y columnas o dividí el archivo en partes.'
      : 'No se pudieron importar las filas. Revisá los datos del archivo e intentá de nuevo.';
    if (error.status >= 500) return 'No se pudo completar la importación por un problema del servidor. Volvé a intentarlo en unos minutos.';
    return error.message;
  }
  if (error instanceof Error && /timeout|abort|tiempo/i.test(error.name + error.message)) {
    return 'La importación tardó demasiado. Volvé a intentarlo o dividí el archivo en partes.';
  }
  if (error instanceof Error && /backend no configurado|precios inválidos|No se pudo confirmar la importación completa/i.test(error.message)) return error.message;
  return 'Se perdió la conexión durante la importación. Revisá tu conexión y volvé a intentarlo.';
}

async function spreadsheetRequest(user: AuthUserLike, path: string, body: unknown): Promise<ImportAnalysis> {
  try {
    return await apiRequest<ImportAnalysis>(user, path, {
      method: 'POST', body, fallback: 'No se pudo leer la planilla.', timeoutMs: ANALYZE_TIMEOUT_MS,
    });
  } catch (error) { throw new Error(importErrorMessage(error, 'analyze'), { cause: error }); }
}

export async function analyzeImport(
  user: AuthUserLike,
  section: ImportSection,
  sheets: ImportSheetPayload[],
): Promise<ImportAnalysis> {
  const prepared = prepareImportSheets(sheets);
  const result = await spreadsheetRequest(user, '/api/import/analyze', { section, sheets: prepared });
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
  const prepared = prepareImportSheets(sheets);
  const result = await spreadsheetRequest(user, '/api/import/apply', { section, sheets: prepared, plan, refreshMapping });
  captureAnalysis(section, 'apply', result);
  return result;
}

export interface InventoryImportRow {
  sourceRow?: number;
  entryDate?: string | null;
  batteryNote?: string | null;
  supplierName?: string;
  purchasedAt?: string;
  purchaseName?: string;
  imei: string;
  model: string;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: string;
  cost?: number | string;
  price: number | string | null;
  currency?: 'ARS' | 'USD';
  status?: string;
  customFields?: Record<string, unknown>;
}

export interface ImportResult {
  partial?: boolean;
  message?: string;
  skipped?: number;
  withoutImei?: number;
  warnings?: { row: number; message: string }[];
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
  definitions?: CustomFieldInput[],
  onProgress?: (completed: number, total: number) => void,
): Promise<ImportResult> {
  try {
    let result: ImportResult | undefined;
    const batchSize = ['inventory', 'sales'].includes(section) ? Math.max(rows.length, 1) : 400;
    // Preserve the existing empty-request behavior (including configuration errors).
    for (let offset = 0; offset < Math.max(rows.length, 1); offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      const submitted = batch.map((row, index) => {
        const sourceRow = Number(row.sourceRow ?? ('_sourceRow' in row ? row._sourceRow : undefined)) || offset + index + 1;
        return rows.length > 400 || '_sourceRow' in row ? { ...row, sourceRow } : row;
      });
      let next: ImportResult;
      try {
        next = await apiRequest<ImportResult>(user, `/api/${section}/import`, {
          method: 'POST',
          body: { rows: submitted, ...(supplierId ? { supplierId } : {}), ...(definitions?.length ? { definitions } : {}) },
          timeoutMs: 120_000,
          fallback: 'No se pudo completar la importación.',
        });
      } catch (error) {
        if (!result) throw error;
        const firstRow = batch[0];
        const sourceRow = Number(firstRow?.sourceRow ?? (firstRow && '_sourceRow' in firstRow ? firstRow._sourceRow : undefined)) || offset + 1;
        const saved = result.imported + result.updated;
        const noun = section === 'inventory' ? 'equipos' : 'registros';
        const failure = error instanceof ApiError && error.status < 500
          ? `no se pudo continuar en la fila ${sourceRow}. ${importErrorMessage(error, 'import')}`
          : `falló la conexión en la fila ${sourceRow}.`;
        let message = `Se importaron ${saved} ${noun} y ${failure} Volvé a importar el mismo archivo: los que ya entraron se actualizan, no se duplican.`;
        if (section === 'inventory' && rows.some(row => !row.imei?.trim())) message += ' Los equipos sin IMEI pueden duplicarse al reimportar.';
        result = { ...result, partial: true, message, errors: [...result.errors, { row: sourceRow, message }] };
        break;
      }
      if (section !== 'inventory' && section !== 'sales') {
        // Other import endpoints number data rows from 2, independently per request.
        const physicalRow = (localRow: number) => {
          const row = submitted[localRow - 2];
          return Number(row?.sourceRow ?? (row && '_sourceRow' in row ? row._sourceRow : undefined)) || localRow + offset;
        };
        next.errors = next.errors.map(error => ({ ...error, row: physicalRow(error.row) }));
        if (next.warnings) next.warnings = next.warnings.map(warning => ({ ...warning, row: physicalRow(warning.row) }));
        if (next.diagnostics?.warnings) next.diagnostics.warnings = next.diagnostics.warnings.map(warning => ({ ...warning, row: physicalRow(warning.row) }));
        if (next.diagnostics?.rejected) next.diagnostics.rejected = next.diagnostics.rejected.map(error => ({ ...error, row: physicalRow(error.row) }));
      }
      if (['inventory', 'sales'].includes(section) && (next.partial || next.errors.length || next.imported + next.updated !== rows.length)) {
        throw new Error('No se pudo confirmar la importación completa: el conteo guardado no coincide con la vista previa. Revisá el inventario antes de reintentar.');
      }
      result = result ? mergeImportResults(result, next) : next;
      onProgress?.(Math.min(offset + batch.length, rows.length), rows.length);
    }
    result ??= { imported: 0, updated: 0, errors: [] };
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
    throw new Error(importErrorMessage(error, 'import'), { cause: error });
  }
}

function mergeImportResults(left: ImportResult, right: ImportResult): ImportResult {
  const result: ImportResult = { imported: left.imported + right.imported, updated: left.updated + right.updated,
    errors: [...left.errors, ...right.errors] };
  for (const key of ['priceToDefine', 'skipped', 'withoutImei'] as const) {
    if (left[key] !== undefined || right[key] !== undefined) result[key] = (left[key] ?? 0) + (right[key] ?? 0);
  }
  if (left.warnings || right.warnings) result.warnings = [...(left.warnings ?? []), ...(right.warnings ?? [])];
  if (left.diagnostics && right.diagnostics) {
    const a = left.diagnostics, b = right.diagnostics;
    const discardedByReason = { ...a.discardedByReason };
    for (const [key, count] of Object.entries(b.discardedByReason)) {
      const reason = key as keyof typeof discardedByReason;
      discardedByReason[reason] = (discardedByReason[reason] ?? 0) + (count ?? 0);
    }
    result.diagnostics = { detectedRows: a.detectedRows + b.detectedRows, acceptedRows: a.acceptedRows + b.acceptedRows,
      discardedRows: a.discardedRows + b.discardedRows, discardedByReason,
      missingRequiredFields: [...new Set([...a.missingRequiredFields, ...b.missingRequiredFields])],
      missingRecommendedFields: [...new Set([...a.missingRecommendedFields, ...b.missingRecommendedFields])],
      ...(a.warnings || b.warnings ? { warnings: [...(a.warnings ?? []), ...(b.warnings ?? [])] } : {}),
      ...(a.rejected || b.rejected ? { rejected: [...(a.rejected ?? []), ...(b.rejected ?? [])] } : {}),
    };
  }
  return result;
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
