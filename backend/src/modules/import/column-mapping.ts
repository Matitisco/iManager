import type { ImportField } from "./import-catalog.js";

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

// Three passes: hints, exact key/label, then substring. A file column is used at most once.
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
      if (!header.trim()) continue;
      if (hints[normalizeHeader(header)] === field.key && claim(field.key, header)) break;
    }
    if (mapping[field.key]) continue;

    for (const header of headers) {
      if (!header.trim()) continue;
      const normalized = normalizeHeader(header);
      if ((normalized === nKey || normalized === nLabel) && claim(field.key, header)) break;
    }
    if (mapping[field.key]) continue;

    for (const header of headers) {
      if (!header.trim()) continue;
      const normalized = normalizeHeader(header);
      const labelMatch = nLabel.length >= 4 && normalized.includes(nLabel);
      if ((normalized.includes(nKey) || labelMatch) && claim(field.key, header)) break;
    }
  }

  return mapping;
}
