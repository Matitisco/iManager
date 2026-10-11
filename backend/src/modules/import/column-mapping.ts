import { decisionChoices, IGNORE_COLUMN, type ImportCatalog, type ImportField } from "./import-catalog.js";

export const MAX_SAMPLES = 8;
export const MAX_SAMPLE_CHARS = 80;
export const REVIEW_CONFIDENCE = 0.7;

export type ColumnSuggestion = {
  header: string;
  field: string | null;
  confidence: number | null;
  review: boolean;
  suggestedField: string | null;
};

export type ColumnDecision = {
  header: string;
  choice: string;
  confidence: number;
};

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_\-.]/g, "")
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n");
}

// Same three passes as the importer: hints, exact key/label, then substring.
// A file column is used at most once.
export function autoMap(
  headers: string[],
  fields: Pick<ImportField, "key" | "label">[],
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
    const nKey = normalizeHeader(field.key);
    const nLabel = normalizeHeader(field.label);

    for (const header of headers) {
      if (hints[normalizeHeader(header)] === field.key && claim(field.key, header)) break;
    }
    if (mapping[field.key]) continue;

    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if ((normalized === nKey || normalized === nLabel) && claim(field.key, header)) break;
    }
    if (mapping[field.key]) continue;

    for (const header of headers) {
      const normalized = normalizeHeader(header);
      const labelMatch = nLabel.length >= 4 && normalized.includes(nLabel);
      if ((normalized.includes(nKey) || labelMatch) && claim(field.key, header)) break;
    }
  }

  return mapping;
}

export function heuristicSuggestions(headers: string[], catalog: ImportCatalog): ColumnSuggestion[] {
  const fieldToHeader = autoMap(headers, catalog.fields, catalog.hints);
  const headerToField = new Map<string, string>();
  for (const field of catalog.fields) {
    const header = fieldToHeader[field.key];
    if (header) headerToField.set(header, field.key);
  }

  return headers.map((header) => {
    const field = headerToField.get(header) ?? null;
    return {
      header,
      field,
      confidence: null,
      review: false,
      suggestedField: field,
    };
  });
}

export function trimSamples(samples: string[]): string[] {
  const trimmed: string[] = [];
  for (const sample of samples) {
    const value = sample.trim().slice(0, MAX_SAMPLE_CHARS);
    if (!value) continue;
    trimmed.push(value);
    if (trimmed.length >= MAX_SAMPLES) break;
  }
  return trimmed;
}

export function columnInput(header: string, samples: string[]): string {
  const lines = [`Encabezado: ${header}`];
  if (samples.length > 0) {
    lines.push("Valores de muestra:");
    samples.forEach((sample, index) => lines.push(`${index + 1}. ${sample}`));
  }
  return lines.join("\n");
}

export function resolveDecisions(columns: ColumnDecision[]): ColumnSuggestion[] {
  const ranked = columns
    .map((column, index) => ({ ...column, index }))
    .filter((column) => column.choice !== IGNORE_COLUMN)
    .sort((left, right) => right.confidence - left.confidence || left.index - right.index);

  const winners = new Set<number>();
  const taken = new Set<string>();
  for (const column of ranked) {
    if (taken.has(column.choice)) continue;
    taken.add(column.choice);
    winners.add(column.index);
  }

  return columns.map((column, index) => {
    if (column.choice === IGNORE_COLUMN) {
      return {
        header: column.header,
        field: null,
        confidence: column.confidence,
        review: column.confidence < REVIEW_CONFIDENCE,
        suggestedField: null,
      };
    }

    const won = winners.has(index);
    return {
      header: column.header,
      field: won ? column.choice : null,
      confidence: column.confidence,
      review: !won || column.confidence < REVIEW_CONFIDENCE,
      suggestedField: column.choice,
    };
  });
}

export function catalogChoices(catalog: ImportCatalog) {
  return decisionChoices(catalog);
}
