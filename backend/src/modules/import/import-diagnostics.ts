import type { ImportSection } from "./import-catalog.js";

export const DISCARD_REASONS = [
  "empty", "footer", "section_header", "excluded_sheet", "missing_model", "missing_price",
  "missing_name", "missing_client", "missing_device", "missing_identity", "invalid_price",
  "invalid_imei", "invalid_row", "duplicate", "ambiguous_client", "client_not_found", "save_error",
] as const;
export type DiscardReason = (typeof DISCARD_REASONS)[number];
export type ImportWarning = { row: number; message: string };
export type ImportRejection = { row: number; reason: DiscardReason; message: string };
export type ImportDiagnostics = {
  warnings?: ImportWarning[];
  rejected?: ImportRejection[];
  /** Physical rows in the selected data range (submitted rows for persistence). */
  detectedRows: number;
  /** Physical rows retained; inventory quantity expansion is separate from this count. */
  acceptedRows: number;
  discardedRows: number;
  discardedByReason: Partial<Record<DiscardReason, number>>;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
};

const FIELDS: Record<ImportSection, { required: string[]; recommended: string[] }> = {
  inventory: { required: ["model"], recommended: ["price", "imei"] },
  sales: { required: ["amount"], recommended: ["date", "clientName", "device", "productImei"] },
  clients: { required: ["name"], recommended: ["phone"] },
  "trade-ins": { required: ["clientName", "deviceReceived", "deviceGiven"], recommended: ["takeValue", "differencePaid"] },
};

export function emptyDiagnostics(): ImportDiagnostics {
  return { detectedRows: 0, acceptedRows: 0, discardedRows: 0, discardedByReason: {}, missingRequiredFields: [], missingRecommendedFields: [] };
}

export function missingFields(section: ImportSection, mapped: Iterable<string>): Pick<ImportDiagnostics, "missingRequiredFields" | "missingRecommendedFields"> {
  const keys = new Set(mapped);
  return {
    missingRequiredFields: FIELDS[section].required.filter((key) => !keys.has(key)),
    missingRecommendedFields: FIELDS[section].recommended.filter((key) => !keys.has(key)),
  };
}

export function countDiscard(diagnostics: ImportDiagnostics, reason: DiscardReason): void {
  diagnostics.discardedRows += 1;
  diagnostics.discardedByReason[reason] = (diagnostics.discardedByReason[reason] ?? 0) + 1;
}

/** Preserve existing error payloads; only aggregate stable reason keys. */
export function importErrorCollector<T extends { row: number; message: string }>(errors: T[]) {
  const diagnostics = emptyDiagnostics();
  return {
    reject(error: T, reason: DiscardReason) {
      errors.push(error);
      countDiscard(diagnostics, reason);
      recordRejection(diagnostics, { row: error.row, reason, message: error.message });
    },
    finish(detected: number, accepted: number): ImportDiagnostics {
      return { ...diagnostics, detectedRows: detected, acceptedRows: accepted };
    },
  };
}

export function recordRejection(diagnostics: ImportDiagnostics, rejection: ImportRejection): void {
  const rejected = diagnostics.rejected ??= [];
  if (rejected.length < 50) rejected.push(rejection);
}
