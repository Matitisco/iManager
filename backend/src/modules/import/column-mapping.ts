import type { ImportField } from "./import-catalog.js";

export function normalizeHeader(value: string): string {
  return value.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9$]/g, "");
}

/** Purchase amounts are never sale prices, including compound headers. */
export function isPurchaseHeader(header: string): boolean {
  return /costo|cost|compra|comprado|purchase|buy|adquisicion|inversion/.test(normalizeHeader(header));
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
    if ((hints[normalizeHeader(header)] && hints[normalizeHeader(header)] !== fieldKey) || mapping[fieldKey] || used.has(header) || ((fieldKey === "price" || fieldKey === "amount") && isPurchaseHeader(header))) return false;
    mapping[fieldKey] = header;
    used.add(header);
    return true;
  };

  for (const field of fields) {
    for (const header of headers) {
      if (!header.trim()) continue;
      if (hints[normalizeHeader(header)] === field.key && claim(field.key, header)) break;
    }
  }

  for (const field of fields) {
    if (mapping[field.key]) continue;
    const nKey = normalizeHeader(field.key);
    const nLabel = normalizeHeader(field.label);
    for (const header of headers) {
      if (!header.trim()) continue;
      const normalized = normalizeHeader(header);
      if ((normalized === nKey || normalized === nLabel) && claim(field.key, header)) break;
    }
  }

  for (const field of fields) {
    if (mapping[field.key]) continue;
    const nKey = normalizeHeader(field.key);
    const nLabel = normalizeHeader(field.label);
    for (const header of headers) {
      if (!header.trim()) continue;
      const normalized = normalizeHeader(header);
      const labelMatch = nLabel.length >= 4 && normalized.includes(nLabel);
      if ((normalized.includes(nKey) || labelMatch) && claim(field.key, header)) break;
    }
  }

  return mapping;
}
