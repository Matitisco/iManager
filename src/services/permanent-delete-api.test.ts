import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { permanentDeleteErrorMessage, permanentlyDeleteBackendRecord, type PermanentDeleteKind } from './permanent-delete-api';
import { ApiError } from './api-client';
import { fetchWithTimeout } from './fetch-with-timeout';

vi.mock('./fetch-with-timeout', () => ({ fetchWithTimeout: vi.fn() }));
const user = { uid: 'fixture', email: null, displayName: null, getIdToken: async () => 'test' };
beforeEach(() => {
  vi.mocked(fetchWithTimeout).mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('__IMANAGER_TEST_API_BASE_URL__', 'https://api.imanager.test/');
});
afterEach(() => vi.unstubAllGlobals());

describe('permanent deletion transport', () => {
  it.each<[PermanentDeleteKind, string]>([
    ['eq', 'inventory'], ['sale', 'sales'], ['cl', 'clients'], ['cj', 'trade-ins'], ['ot', 'repairs'],
  ])('sends DELETE to the final API URL for %s', async (kind, path) => {
    await expect(permanentlyDeleteBackendRecord(user, kind, 'id/with/slash')).resolves.toBeUndefined();
    expect(fetchWithTimeout).toHaveBeenCalledExactlyOnceWith(
      `https://api.imanager.test/api/${path}/id%2Fwith%2Fslash/permanent`,
      expect.objectContaining({ method: 'DELETE', headers: expect.objectContaining({ Authorization: 'Bearer test' }) }),
    );
  });

  it.each([
    [404, 'No encontramos este registro: puede que ya se haya borrado. Actualizá la pantalla.'],
    [403, 'Solo el dueño de la tienda puede borrar definitivamente.'],
    [409, 'Primero anulá o archivá el registro para poder borrarlo.'],
    [400, 'No se pudo borrar. Revisá tu conexión y reintentá.'],
    [500, 'No se pudo borrar. Revisá tu conexión y reintentá.'],
    [503, 'No se pudo borrar. Revisá tu conexión y reintentá.'],
  ])('preserves status %s for reconciliation and provides the requested message', async (status, message) => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response('Internal backend detail', { status: Number(status) }));
    const error: unknown = await permanentlyDeleteBackendRecord(user, 'cl', 'id').catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status });
    expect(permanentDeleteErrorMessage(error)).toBe(message);
  });

  it.each([new TypeError('Failed to fetch'), new DOMException('Aborted', 'AbortError'), new Error('Unexpected error')])('provides the retry message for $name', async error => {
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(error);
    const failure: unknown = await permanentlyDeleteBackendRecord(user, 'cl', 'id').catch((error: unknown) => error);
    expect(permanentDeleteErrorMessage(failure)).toBe('No se pudo borrar. Revisá tu conexión y reintentá.');
  });
});
