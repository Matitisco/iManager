import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/api-client';
import { getFriendlyErrorMessage } from './utils';
import { DEFAULT_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE, toUserMessage } from './user-message';

afterEach(() => vi.restoreAllMocks());

describe('toUserMessage', () => {
  it('uses the exact Spanish copy required for connection, timeout and server failures', () => {
    expect(NETWORK_ERROR_MESSAGE).toBe('No hay conexión. Revisá tu internet y probá de nuevo.');
    expect(TIMEOUT_ERROR_MESSAGE).toBe('La solicitud tardó demasiado. Probá de nuevo.');
    expect(SERVER_ERROR_MESSAGE).toBe('Ocurrió un error en el servidor. Probá de nuevo en unos minutos.');
  });

  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])('translates the browser error %s', (message) => {
    expect(toUserMessage(new TypeError(message))).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage(new Error(message))).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage(message)).toBe(NETWORK_ERROR_MESSAGE);
    expect(getFriendlyErrorMessage(new TypeError(message), 'No se pudo guardar.')).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('recognizes NetworkError, SDK codes and plain rejection objects', () => {
    expect(toUserMessage(new DOMException('', 'NetworkError'))).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage({ name: 'NetworkError', message: '' })).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage({ message: 'Load failed' })).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage({ code: 'auth/network-request-failed' })).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage(new Error('{"error":"Failed to fetch"}'))).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('recognizes navigator offline without needing a browser-specific message', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(toUserMessage(new Error('The Internet connection appears to be offline.'))).toBe(NETWORK_ERROR_MESSAGE);
    expect(toUserMessage(undefined)).toBe(NETWORK_ERROR_MESSAGE);
    // A real HTTP response takes precedence over the navigator hint.
    expect(toUserMessage(new ApiError(409, 'IMEI duplicado'))).toBe('IMEI duplicado');
    expect(toUserMessage(new ApiError(503, 'Service unavailable'))).toBe(SERVER_ERROR_MESSAGE);
  });

  it.each([
    new DOMException('The operation was aborted.', 'AbortError'),
    new DOMException('The operation timed out.', 'TimeoutError'),
    new Error('timeout'),
    { name: 'AbortError', message: 'The user aborted a request.' },
  ])('translates timeouts: %s', (error) => {
    expect(toUserMessage(error)).toBe(TIMEOUT_ERROR_MESSAGE);
  });

  it.each([500, 502, 503, 504, 599])('translates HTTP %s regardless of the response text', (status) => {
    expect(toUserMessage(new ApiError(status, 'Internal Server Error'))).toBe(SERVER_ERROR_MESSAGE);
    expect(toUserMessage({ statusCode: status, error: 'Detalle privado del servidor' })).toBe(SERVER_ERROR_MESSAGE);
  });

  it.each([400, 401, 403, 404, 409, 422])('preserves Spanish HTTP %s validations', (status) => {
    expect(toUserMessage(new ApiError(status, 'No tenés permiso para eliminar este canje.'))).toBe('No tenés permiso para eliminar este canje.');
    expect(toUserMessage({ status, error: 'Stock insuficiente' })).toBe('Stock insuficiente');
  });

  it.each(['Something went wrong', 'An unexpected error occurred', 'Error: Could not save', "Cannot read properties of undefined (reading 'id')", 'Firebase: Error (auth/internal-error).', 'Bad Request', 'Only sales source can edit a sale', 'Inventory source requires an existing product sale'])('hides technical English: %s', (message) => {
    expect(toUserMessage(new Error(message))).toBe(DEFAULT_ERROR_MESSAGE);
    expect(toUserMessage({ message })).toBe(DEFAULT_ERROR_MESSAGE);
  });

  it('reads Spanish JSON and field validations and handles unknown rejections', () => {
    expect(toUserMessage(new Error('{"error":"El precio no puede ser negativo"}'))).toBe('El precio no puede ser negativo');
    expect(toUserMessage({ error: 'Bad Request', fields: { price: 'Revisá el precio' } })).toBe('Revisá el precio');
    expect(toUserMessage(null, 'No se pudo guardar.')).toBe('No se pudo guardar.');
    expect(toUserMessage(42)).toBe(DEFAULT_ERROR_MESSAGE);
    expect(toUserMessage('')).toBe(DEFAULT_ERROR_MESSAGE);
    expect(toUserMessage(new ApiError(400, 'Error: Revisá el precio.'))).toBe('Error: Revisá el precio.');
  });

  it('keeps normalized timeout/server messages stable across UI boundaries while offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(toUserMessage(new Error(TIMEOUT_ERROR_MESSAGE))).toBe(TIMEOUT_ERROR_MESSAGE);
    expect(toUserMessage(new Error(SERVER_ERROR_MESSAGE))).toBe(SERVER_ERROR_MESSAGE);
  });

  it('hides runtime errors whose browser-specific wording is unknown', () => {
    expect(toUserMessage(new TypeError('a is not an object'))).toBe(DEFAULT_ERROR_MESSAGE);
    expect(toUserMessage(new SyntaxError('JSON.parse: unterminated string literal'))).toBe(DEFAULT_ERROR_MESSAGE);
    expect(toUserMessage(new ReferenceError('x is not defined'))).toBe(DEFAULT_ERROR_MESSAGE);
  });
});
