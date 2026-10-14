import { toUserMessage } from './user-message';

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
  return toUserMessage(error, fallback);
}
