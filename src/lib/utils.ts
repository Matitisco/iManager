import { isTechnicalMessage, readApiErrorMessage } from "./api-message"

export function trimToString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    return messageFromText(error, fallback);
  }

  if (error instanceof Error) {
    return messageFromText(error.message, fallback);
  }

  if (error && typeof error === 'object') {
    return readApiErrorMessage(error, fallback);
  }

  return fallback;
}

function messageFromText(value: string, fallback: string): string {
  const parsed = parseErrorPayload(value);
  if (parsed !== undefined) return readApiErrorMessage(parsed, fallback);
  if (!value.trim() || isTechnicalMessage(value)) return fallback;
  return value;
}

function parseErrorPayload(value: string): unknown | undefined {
  const text = value.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
