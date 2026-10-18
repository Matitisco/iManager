export type FieldSchema = {
  field: string;
  label: string;
  format?: (value: unknown) => string | null;
};

export type AuditChange = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

function parseAuditNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || value === "") return null;
  const raw = typeof value === "object" && value && "toString" in value ? String((value as { toString(): string }).toString()) : String(value);
  const text = raw.trim().replace(/\s/g, "");
  if (!text) return null;
  if (/^-?\d+\.\d{1,4}$/.test(text)) return Number(text);
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) return Number(text.replace(/\./g, "").replace(",", "."));
  const normalized = text.replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatAuditMoney(value: unknown): string | null {
  const numeric = parseAuditNumber(value);
  if (numeric == null) return null;
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.abs(Math.round(numeric)));
  return `${numeric < 0 ? "-" : ""}$ ${formatted}`;
}

export function formatAuditDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function plain(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return formatAuditDate(value);
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text === "{}" || text === "[]" || text === "null" ? null : text;
  }
  const text = String(value).trim();
  return text || null;
}

/** Compares a whitelist of fields. Returns nothing when the visible values did not change. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  schema: FieldSchema[],
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const spec of schema) {
    const format = spec.format ?? plain;
    const left = format(before[spec.field]);
    const right = format(after[spec.field]);
    if (left === right) continue;
    changes.push({ field: spec.field, label: spec.label, before: left, after: right });
  }
  return changes;
}

export const MONEY = formatAuditMoney;
export const DATE = formatAuditDate;
