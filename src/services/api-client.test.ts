import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api-client';
import { fetchWithTimeout } from './fetch-with-timeout';
import { NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from '../lib/user-message';

vi.mock('./fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

const mockUser = {
  uid: 'user-1',
  email: 'owner@imanager.test',
  displayName: 'Owner',
  getIdToken: vi.fn().mockResolvedValue('token-123'),
};

function setApiBaseUrl(value: string) {
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const zodText = '[{"code":"too_small","minimum":0,"message":"Number must be greater than 0"}]';

describe('apiRequest', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('fails before asking for a token when the backend is not configured', async () => {
    setApiBaseUrl('');
    await expect(apiRequest(mockUser, '/api/sales', { fallback: 'x' })).rejects.toThrow('Backend no configurado');
    expect(mockUser.getIdToken).not.toHaveBeenCalled();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('sends JSON only when there is a body and resolves 204 as undefined', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(apiRequest(mockUser, '/api/items', { method: 'POST', body: { name: 'A' }, fallback: 'x' })).resolves.toEqual({ ok: true });
    await expect(apiRequest(mockUser, '/api/items/1', { method: 'DELETE', fallback: 'x' })).resolves.toBeUndefined();

    expect(fetchWithTimeout).toHaveBeenNthCalledWith(1, 'https://api.imanager.test/api/items', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'x-im-device': 'desktop', Authorization: 'Bearer token-123', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{"name":"A"}',
    });
    expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, 'https://api.imanager.test/api/items/1', {
      method: 'DELETE',
      cache: 'no-store',
      headers: { 'x-im-device': 'desktop', Authorization: 'Bearer token-123', Accept: 'application/json' },
    });
  });

  it('reads the backend error field by default and keeps the status', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ error: 'Stock insuficiente' }, 409))
      .mockResolvedValueOnce(new Response('oops', { status: 502 }));

    const conflict = await apiRequest(mockUser, '/api/sales', { fallback: 'x' }).catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(ApiError);
    expect(conflict).toMatchObject({ status: 409, message: 'Stock insuficiente' });
    await expect(apiRequest(mockUser, '/api/sales', { fallback: (status) => `Falló (${status})` })).rejects.toThrow('Ocurrió un error en el servidor. Probá de nuevo en unos minutos.');
  });

  it('hides technical text in friendly mode and ignores the body in fallback mode', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ error: zodText, fields: { amount: 'El pago no puede ser negativo' } }, 400))
      .mockResolvedValueOnce(json({ error: zodText }, 400))
      .mockResolvedValueOnce(json({ error: 'Detalle del servidor' }, 403));

    await expect(apiRequest(mockUser, '/a', { fallback: 'x', errorFrom: 'friendly' })).rejects.toThrow('El pago no puede ser negativo');
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar', errorFrom: 'friendly' })).rejects.toThrow('No se pudo guardar');
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudieron cargar los pagos', errorFrom: 'fallback' })).rejects.toThrow('No se pudieron cargar los pagos');
  });

  it('muestra un 503 de facturación con texto seguro y oculta un 503 técnico', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ error: 'La facturación no está disponible en este momento. Contactá a iManager.' }, 503))
      .mockResolvedValueOnce(json({ error: 'invalid access token' }, 503))
      .mockResolvedValueOnce(json({ error: 'La facturación no está disponible en este momento. Contactá a iManager.' }, 503));
    await expect(apiRequest(mockUser, '/api/billing/checkout', { fallback: 'x', revealFriendlyServerError: true })).rejects.toThrow('La facturación no está disponible en este momento. Contactá a iManager.');
    await expect(apiRequest(mockUser, '/api/billing/checkout', { fallback: 'x', revealFriendlyServerError: true })).rejects.toThrow(SERVER_ERROR_MESSAGE);
    await expect(apiRequest(mockUser, '/api/billing/checkout', { fallback: 'x' })).rejects.toThrow(SERVER_ERROR_MESSAGE);
  });

  it.each(['error', 'friendly', 'fallback'] as const)('uses the server message in %s mode even for a non-JSON 5xx body', async (errorFrom) => {
    for (const status of [500, 502, 503, 504]) {
      vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', { status }));
      const error = await apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar.', errorFrom }).catch((cause: unknown) => cause);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, message: SERVER_ERROR_MESSAGE });
    }
  });

  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])('normalizes rejected requests: %s', async (message) => {
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(new TypeError(message));
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar.' })).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });

  it('normalizes timeout rejections and token network failures', async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar.' })).rejects.toThrow(TIMEOUT_ERROR_MESSAGE);
    mockUser.getIdToken.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar.' })).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });

  it('reads Spanish 4xx error, message and field validations without leaking English HTTP text', async () => {
    for (const body of [
      { error: 'No tenés permiso para eliminar el canje.' },
      { message: 'No tenés permiso para eliminar el canje.' },
      { error: 'Forbidden', fields: { permission: 'No tenés permiso para eliminar el canje.' } },
    ]) {
      vi.mocked(fetchWithTimeout).mockResolvedValueOnce(json(body, 403));
      await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar.' })).rejects.toMatchObject({ status: 403, message: 'No tenés permiso para eliminar el canje.' });
    }
  });
});
