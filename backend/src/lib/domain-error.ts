export class DomainError extends Error {
  readonly statusCode: number;
  /** Safe fields for logs. Never sent in the HTTP body. */
  readonly logContext?: Record<string, unknown>;

  constructor(message: string, statusCode = 400, logContext?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.logContext = logContext;
  }
}

export function domainErrorFrom(error: unknown): DomainError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (current instanceof DomainError) return current;
    if (!("cause" in current)) return null;
    current = (current as { cause?: unknown }).cause;
  }
  return current instanceof DomainError ? current : null;
}
