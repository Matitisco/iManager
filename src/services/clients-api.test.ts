import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../types';
import {
  bulkMoveClientCategoryApi,
  createBackendClient,
  createClientCategoryApi,
  deleteBackendClient,
  fetchBackendClients,
  fetchClientCategoriesApi,
  renameClientCategoryApi,
  updateBackendClient,
} from './clients-api';
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

const clientFixture: Client = {
  id: 'client-1',
  dni: '11222333',
  name: 'Ana Torres',
  email: 'ana@imanager.test',
  phone: '2614000001',
  lastPurchaseDate: '2026-04-20',
  totalSpent: 2500,
  pendingBalance: 100,
  categoryId: 'cat-1',
};

const { id: _clientId, ...createClientPayload } = clientFixture;

function setApiBaseUrl(value: string) {
  (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('clients-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test/');
  });

  it('loads clients using the trimmed backend url and auth headers', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({ clients: [clientFixture] }),
    );

    await expect(fetchBackendClients(mockUser)).resolves.toEqual([clientFixture]);
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/clients', {
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  });

  it('surfaces backend errors while creating clients and validates the response shape', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        jsonResponse({ error: 'DNI duplicado' }, 409),
      )
      .mockResolvedValueOnce(
        jsonResponse({ ok: true }, 201),
      );

    await expect(createBackendClient(mockUser, createClientPayload)).rejects.toThrow('DNI duplicado');
    await expect(createBackendClient(mockUser, createClientPayload)).rejects.toThrow(/Respuesta inv/);
  });

  it('updates clients through PATCH and returns the persisted record', async () => {
    const updatedClient: Client = {
      ...clientFixture,
      name: 'Ana Gomez',
      pendingBalance: 0,
    };

    vi.mocked(fetchWithTimeout).mockResolvedValue(
      jsonResponse({ client: updatedClient }),
    );

    await expect(updateBackendClient(mockUser, updatedClient)).resolves.toEqual(updatedClient);
    expect(fetchWithTimeout).toHaveBeenCalledWith(`https://api.imanager.test/api/clients/${updatedClient.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedClient),
    });
  });

  it('accepts 204 deletes and rejects failing category bulk moves', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

    await expect(deleteBackendClient(mockUser, 'client-1')).resolves.toBeUndefined();
    await expect(bulkMoveClientCategoryApi(mockUser, ['client-1'], null)).rejects.toThrow(/Error moviendo clientes/i);
  });

  it('deletes without a JSON content type so Fastify accepts the empty body', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(new Response(null, { status: 204 }));

    await deleteBackendClient(mockUser, 'client-1');
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/clients/client-1', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
      },
    });
  });

  it('covers client category fetch, create and rename flows', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({ categories: [{ id: 'cat-1', name: 'Mayoristas' }] }))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'VIP' } }, 201))
      .mockResolvedValueOnce(jsonResponse({ category: { id: 'cat-2', name: 'VIP Norte' } }));

    await expect(fetchClientCategoriesApi(mockUser)).resolves.toEqual([{ id: 'cat-1', name: 'Mayoristas' }]);
    await expect(createClientCategoryApi(mockUser, 'VIP')).resolves.toEqual({ id: 'cat-2', name: 'VIP' });
    await expect(renameClientCategoryApi(mockUser, 'cat-2', 'VIP Norte')).resolves.toEqual({
      id: 'cat-2',
      name: 'VIP Norte',
    });
  });
});
