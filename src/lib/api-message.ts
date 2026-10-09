const GENERIC_STATUSES = new Set([
  "internal server error",
  "bad request",
  "unauthorized",
  "forbidden",
  "not found",
  "unprocessable entity",
]);

export function readApiErrorMessage(body: unknown, fallback: string): string {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const fields = record.fields && typeof record.fields === "object"
    ? Object.values(record.fields as Record<string, unknown>)
    : [];

  for (const candidate of [record.error, record.message, ...fields]) {
    const text = friendlyText(candidate);
    if (text) return text;
  }

  return fallback;
}

export function isTechnicalMessage(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (text.includes("\n    at ")) return true;
  if (/"code"\s*:\s*"(too_small|too_big|invalid_type|invalid_enum_value|invalid_string|unrecognized_keys|custom)"/.test(text)) {
    return true;
  }

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.some((item) => Boolean(item) && typeof item === "object" && item !== null && "code" in item);
      }
    } catch {
      return text.includes('"code"');
    }
  }

  return false;
}

function friendlyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || GENERIC_STATUSES.has(text.toLowerCase()) || isTechnicalMessage(text)) return null;
  return text;
}
