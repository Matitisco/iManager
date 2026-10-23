import { isTechnicalMessage, readApiErrorMessage } from './api-message';

export const NETWORK_ERROR_MESSAGE = 'No hay conexión. Revisá tu internet y probá de nuevo.';
export const TIMEOUT_ERROR_MESSAGE = 'La solicitud tardó demasiado. Probá de nuevo.';
export const SERVER_ERROR_MESSAGE = 'Ocurrió un error en el servidor. Probá de nuevo en unos minutos.';
export const DEFAULT_ERROR_MESSAGE = 'No se pudo completar la acción. Probá de nuevo.';
export const ACTION_ERROR_MESSAGE = 'No se pudo completar. Probá de nuevo.';

/** Network messages remain internal signals for reconnect/retry, never UI copy. */
export function isNetworkErrorMessage(message: string | null | undefined): boolean {
  return !!message && (message === NETWORK_ERROR_MESSAGE
    || /no hay conexi[oó]n|sin conexi[oó]n|error de conexi[oó]n|failed to fetch|load failed|network\s*error|network request failed|failed to load resource|internet connection.*offline/i.test(message));
}

/** User-initiated failures stay visible without exposing connection status. */
export function toActionMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const message = toUserMessage(error, fallback);
  return isNetworkErrorMessage(message) ? ACTION_ERROR_MESSAGE : message;
}

/** Normalize errors for internal state and recovery. Hide network load errors at
 * render time; use toActionMessage for user-initiated failures. */
export function toUserMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = record.status ?? record.statusCode;
  const httpError = typeof status === 'number' && status >= 400 && status < 600;
  if (httpError && status >= 500) return SERVER_ERROR_MESSAGE;

  const message = typeof error === 'string' ? error : typeof record.message === 'string' ? record.message : typeof record.error === 'string' ? record.error : '';
  const text = message.trim();
  // A previously normalized error can cross several service/UI boundaries.
  if ([NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE, SERVER_ERROR_MESSAGE].includes(text)) return text;
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      return toUserMessage(httpError && parsed && typeof parsed === 'object' ? { ...parsed, status } : parsed, fallback);
    } catch { /* Fall through to the technical-text filter. */ }
  }
  const name = record.name;
  if (!httpError) {
    if (name === 'TimeoutError' || name === 'AbortError' || /\b(?:timeout|timed out)\b/i.test(message)) {
      return TIMEOUT_ERROR_MESSAGE;
    }
    if (name === 'NetworkError' || record.code === 'auth/network-request-failed'
      || isNetworkErrorMessage(message)
      || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      return NETWORK_ERROR_MESSAGE;
    }
    if (name === 'TypeError' || name === 'SyntaxError' || name === 'ReferenceError') return fallback;
  }

  if (error && typeof error === 'object' && !(error instanceof Error)) {
    return readApiErrorMessage(error, fallback);
  }
  if (!text || isTechnicalMessage(text)) return fallback;
  return readApiErrorMessage({ message: text }, fallback);
}
