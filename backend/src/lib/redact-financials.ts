const FINANCIAL_KEYS = new Set([
  "cost",
  "costValue",
  "grossProfit",
  "grossProfitChange",
  "margin",
  "marginRate",
  "grossMargin",
]);

function isPlainObject(value: object) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date || !isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (FINANCIAL_KEYS.has(key)) continue;
    output[key] = strip(child);
  }
  return output;
}

/** Drops cost and margin fields from a JSON response. */
export function redactFinancials<T>(payload: T): T {
  return strip(payload) as T;
}
