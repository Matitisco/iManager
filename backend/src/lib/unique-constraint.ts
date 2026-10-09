export function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && (error as { code?: unknown }).code === "P2002") return true;
  if ("cause" in error) return isUniqueConstraintError((error as { cause?: unknown }).cause);
  return false;
}
