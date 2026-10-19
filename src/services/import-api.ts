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
  supplierId?: string,
): Promise<ImportResult> {
  return apiRequest<ImportResult>(user, `/api/${section}/import`, {
    method: 'POST',
    body: supplierId ? { rows, supplierId } : { rows },
    fallback: (status) => `Error al importar (${status})`,
  });
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
