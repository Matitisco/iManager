import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api-client';
import { fetchWithTimeout } from './fetch-with-timeout';

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
      headers: { Authorization: 'Bearer token-123', Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{"name":"A"}',
    });
    expect(fetchWithTimeout).toHaveBeenNthCalledWith(2, 'https://api.imanager.test/api/items/1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123', Accept: 'application/json' },
    });
  });

  it('reads the backend error field by default and keeps the status', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ error: 'Stock insuficiente' }, 409))
      .mockResolvedValueOnce(new Response('oops', { status: 502 }));

    const conflict = await apiRequest(mockUser, '/api/sales', { fallback: 'x' }).catch((error: unknown) => error);
    expect(conflict).toBeInstanceOf(ApiError);
    expect(conflict).toMatchObject({ status: 409, message: 'Stock insuficiente' });
    await expect(apiRequest(mockUser, '/api/sales', { fallback: (status) => `Falló (${status})` })).rejects.toThrow('Falló (502)');
  });

  it('hides technical text in friendly mode and ignores the body in fallback mode', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(json({ error: zodText, fields: { amount: 'El pago no puede ser negativo' } }, 400))
      .mockResolvedValueOnce(json({ error: zodText }, 400))
      .mockResolvedValueOnce(json({ error: 'Detalle del servidor' }, 500));

    await expect(apiRequest(mockUser, '/a', { fallback: 'x', errorFrom: 'friendly' })).rejects.toThrow('El pago no puede ser negativo');
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudo guardar', errorFrom: 'friendly' })).rejects.toThrow('No se pudo guardar');
    await expect(apiRequest(mockUser, '/a', { fallback: 'No se pudieron cargar los pagos', errorFrom: 'fallback' })).rejects.toThrow('No se pudieron cargar los pagos');
  });
});
