export class DomainError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}

export function domainErrorFrom(error: unknown): DomainError | null {
  if (error instanceof DomainError) return error;
  if (!error || typeof error !== "object" || !("cause" in error)) return null;
  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof DomainError ? cause : null;
}
