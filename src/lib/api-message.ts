const GENERIC_STATUSES = new Set([
  "internal server error",
  "bad request",
  "unauthorized",
  "forbidden",
  "not found",
  "unprocessable entity",
  "unauthenticated",
  "bad gateway",
  "service unavailable",
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
  // Browser, SDK and runtime diagnostics are not suitable UI messages.
  if (/\b(?:failed|failure|unexpected|something went wrong|network|timeout|typeerror|referenceerror|syntaxerror|aborterror|cannot read|undefined|is not a function|invalid|expected|could not|unable to|must be|not allowed|not implemented|is required|access denied|too many requests|weak password|permission.denied|missing or insufficient permissions)\b/i.test(text)) return true;
  if (/^FirebaseError:|^Firebase:|\bauth\/[a-z-]+\b/i.test(text)) return true;
  if (/\b(?:not found|membership required|missing bearer token|requires|cannot|this source|only sales source|unknown error)\b/i.test(text)) return true;
  if (/\b(?:ECONN\w+|ENOTFOUND|ETIMEDOUT)\b/.test(text)) return true;
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
