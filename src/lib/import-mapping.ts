export const IMPORT_SAMPLE_LIMIT = 8;
export const IMPORT_SAMPLE_CHARS = 80;

export type ColumnSuggestion = {
  header: string;
  field: string | null;
  confidence: number | null;
  review: boolean;
  suggestedField: string | null;
};

export type ColumnNote = {
  header: string;
  suggestedField: string | null;
  confidence: number | null;
};

export function columnSamples(fileRows: Record<string, string>[], header: string): string[] {
  const samples: string[] = [];
  for (const row of fileRows) {
    const value = String(row[header] ?? '').trim().slice(0, IMPORT_SAMPLE_CHARS);
    if (!value) continue;
    samples.push(value);
    if (samples.length >= IMPORT_SAMPLE_LIMIT) break;
  }
  return samples;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s_\-.]/g, '')
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');
}

// Same three passes as the backend heuristic: hints, exact key/label, then substring.
// A file column is used at most once.
export function autoMap(
  headers: string[],
  fields: { key: string; label: string }[],
  hints: Record<string, string> = {},
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  const claim = (fieldKey: string, header: string) => {
    if (mapping[fieldKey] || used.has(header)) return false;
    mapping[fieldKey] = header;
    used.add(header);
    return true;
  };

  for (const field of fields) {
    const nKey = normalize(field.key);
    const nLabel = normalize(field.label);

    for (const header of headers) {
      if (hints[normalize(header)] === field.key && claim(field.key, header)) break;
    }
    if (mapping[field.key]) continue;

    for (const header of headers) {
      const normalized = normalize(header);
      if ((normalized === nKey || normalized === nLabel) && claim(field.key, header)) break;
    }
    if (mapping[field.key]) continue;

    for (const header of headers) {
      const normalized = normalize(header);
      const labelMatch = nLabel.length >= 4 && normalized.includes(nLabel);
      if ((normalized.includes(nKey) || labelMatch) && claim(field.key, header)) break;
    }
  }

  return mapping;
}

export function assignColumn(
  fieldToColumn: Record<string, string>,
  fieldKey: string,
  column: string,
): Record<string, string> {
  const next = { ...fieldToColumn, [fieldKey]: column };
  if (!column) return next;
  for (const key of Object.keys(next)) {
    if (key !== fieldKey && next[key] === column) next[key] = '';
  }
  return next;
}

export function applyColumnSuggestions(
  fields: { key: string }[],
  suggestions: ColumnSuggestion[],
): {
  fieldToColumn: Record<string, string>;
  confidenceByField: Record<string, number | null>;
  reviewByField: Record<string, boolean>;
  notes: ColumnNote[];
} {
  const known = new Set(fields.map((field) => field.key));
  const fieldToColumn: Record<string, string> = {};
  const confidenceByField: Record<string, number | null> = {};
  const reviewByField: Record<string, boolean> = {};
  const notes: ColumnNote[] = [];

  for (const suggestion of suggestions) {
    const field = suggestion.field && known.has(suggestion.field) ? suggestion.field : null;
    if (field && !fieldToColumn[field]) {
      fieldToColumn[field] = suggestion.header;
      confidenceByField[field] = suggestion.confidence;
      reviewByField[field] = suggestion.review;
      continue;
    }
    if (suggestion.review) {
      notes.push({
        header: suggestion.header,
        suggestedField: suggestion.suggestedField && known.has(suggestion.suggestedField) ? suggestion.suggestedField : null,
        confidence: suggestion.confidence,
      });
    }
  }

  return { fieldToColumn, confidenceByField, reviewByField, notes };
}
