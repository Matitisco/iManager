import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackendRepair, deleteBackendRepair } from './repairs-api';
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('repairs-api', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = 'https://api.imanager.test/';
  });

  it('shows the spanish validation message and hides generic server errors', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({
        statusCode: 400,
        error: 'Completá el equipo',
        message: 'Completá el equipo',
        fields: { device: 'Completá el equipo', deposit: 'La seña no puede ser negativa' },
      }, 400))
      .mockResolvedValueOnce(jsonResponse({ statusCode: 500, error: 'Internal Server Error', message: '[{"code":"too_small"}]' }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: 'No tenés permiso para esta acción' }, 403));

    await expect(createBackendRepair(mockUser, { clientName: 'Ana', device: '' })).rejects.toThrow('Completá el equipo');
    await expect(createBackendRepair(mockUser, { clientName: 'Ana', device: 'iPhone 13' })).rejects.toThrow('No se pudo guardar la orden (500)');
    await expect(deleteBackendRepair(mockUser, 'order-1')).rejects.toThrow('No tenés permiso para esta acción');
    expect(fetchWithTimeout).toHaveBeenLastCalledWith('https://api.imanager.test/api/repairs/order-1', expect.objectContaining({ method: 'DELETE' }));
  });
});
