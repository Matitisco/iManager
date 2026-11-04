import { beforeEach, describe, expect, it, vi } from 'vitest';
import { permanentlyDeleteBackendRecord, type PermanentDeleteKind } from './permanent-delete-api';
import { apiRequest } from './api-client';

vi.mock('./api-client', () => ({ apiRequest: vi.fn() }));
const user = { uid: 'fixture', email: null, displayName: null, getIdToken: async () => 'test' };
beforeEach(() => vi.clearAllMocks());

describe('permanent deletion transport', () => {
  it.each<[PermanentDeleteKind, string]>([
    ['eq', 'inventory'], ['sale', 'sales'], ['cl', 'clients'], ['cj', 'trade-ins'], ['ot', 'repairs'],
  ])('uses a distinct DELETE endpoint for %s', async (kind, path) => {
    await permanentlyDeleteBackendRecord(user, kind, 'id/with/slash');
    expect(apiRequest).toHaveBeenCalledWith(user, `/${path}/id%2Fwith%2Fslash/permanent`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('propagates backend permission and state errors', async () => {
    const error = new Error('Solo el dueño de la tienda puede borrar definitivamente.');
    vi.mocked(apiRequest).mockRejectedValueOnce(error);
    await expect(permanentlyDeleteBackendRecord(user, 'cl', 'id')).rejects.toBe(error);
  });
});
