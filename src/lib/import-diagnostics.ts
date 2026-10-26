export const IMPORT_DISCARD_REASONS = [
  'empty', 'footer', 'section_header', 'excluded_sheet', 'missing_model', 'missing_price',
  'missing_name', 'missing_client', 'missing_device', 'missing_identity', 'invalid_price',
  'invalid_imei', 'invalid_row', 'duplicate', 'ambiguous_client', 'client_not_found', 'save_error',
] as const;
export type ImportDiscardReason = typeof IMPORT_DISCARD_REASONS[number];
export type ImportDiagnostics = {
  detectedRows: number;
  acceptedRows: number;
  discardedRows: number;
  discardedByReason: Partial<Record<ImportDiscardReason, number>>;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
};

export type ImportEventProperties = {
  import_type: 'inventory' | 'sales' | 'clients' | 'trade-ins';
  source: 'excel' | 'text';
  phase: 'analyze' | 'apply' | 'commit';
  rows_detected: number;
  rows_prepared: number;
  rows_imported: number;
  rows_updated: number;
  rows_discarded: number;
  discarded_by_reason: ImportDiagnostics['discardedByReason'];
  missing_required_fields: string[];
  missing_recommended_fields: string[];
};

const FIELD_KEYS = new Set([
  'model', 'price', 'imei', 'amount', 'date', 'clientName', 'device', 'productImei',
  'name', 'phone', 'deviceReceived', 'deviceGiven', 'takeValue', 'differencePaid',
]);

const count = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const fields = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string' && FIELD_KEYS.has(key)))] : [];

/** Runtime allowlist: never forward arbitrary objects, error messages or spreadsheet strings. */
export function sanitizeImportEvent(input: ImportEventProperties): ImportEventProperties | undefined {
  if (!input || !['inventory', 'sales', 'clients', 'trade-ins'].includes(input.import_type)
    || !['excel', 'text'].includes(input.source) || !['analyze', 'apply', 'commit'].includes(input.phase)) return;
  const reasons: ImportDiagnostics['discardedByReason'] = {};
  for (const key of IMPORT_DISCARD_REASONS) {
    const value = count(input.discarded_by_reason?.[key]);
    if (value > 0) reasons[key] = value;
  }
  return {
    import_type: input.import_type, source: input.source, phase: input.phase,
    rows_detected: count(input.rows_detected), rows_prepared: count(input.rows_prepared),
    rows_imported: count(input.rows_imported), rows_updated: count(input.rows_updated), rows_discarded: count(input.rows_discarded),
    discarded_by_reason: reasons, missing_required_fields: fields(input.missing_required_fields),
    missing_recommended_fields: fields(input.missing_recommended_fields),
  };
}
