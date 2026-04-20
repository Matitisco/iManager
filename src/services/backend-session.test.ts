import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchBackendSession, getBackendBaseUrl } from './backend-session';
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

describe('backend-session', () => {
  const setApiBaseUrl = (value: string) => {
    (globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string }).__IMANAGER_TEST_API_BASE_URL__ = value;
  };

  beforeEach(() => {
    mockUser.getIdToken.mockResolvedValue('token-123');
    vi.mocked(fetchWithTimeout).mockReset();
    setApiBaseUrl('');
  });

  it('returns null when the backend base url is not configured', () => {
    expect(getBackendBaseUrl()).toBeNull();
  });

  it('returns an unconfigured status when no backend url exists', async () => {
    await expect(fetchBackendSession(mockUser)).resolves.toEqual({
      status: 'unconfigured',
      session: null,
      message: 'Backend no configurado. La app sigue funcionando con el flujo local actual.',
    });
  });

  it('returns a ready session when /api/me succeeds', async () => {
    setApiBaseUrl('https://api.imanager.test/');
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: 'app-user-1', email: 'owner@imanager.test', displayName: 'Owner' },
          store: { id: 'store-1', name: 'Casa Central' },
          membership: { id: 'member-1', role: 'OWNER' },
          onboardingRequired: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(fetchBackendSession(mockUser)).resolves.toEqual({
      status: 'ready',
      session: {
        user: { id: 'app-user-1', email: 'owner@imanager.test', displayName: 'Owner' },
        store: { id: 'store-1', name: 'Casa Central' },
        membership: { id: 'member-1', role: 'OWNER' },
        onboardingRequired: false,
      },
      message: null,
    });
    expect(fetchWithTimeout).toHaveBeenCalledWith('https://api.imanager.test/api/me', {
      headers: {
        Authorization: 'Bearer token-123',
        Accept: 'application/json',
      },
    });
  });

  it('normalizes backend errors for onboarding-required sessions and 5xx responses', async () => {
    setApiBaseUrl('https://api.imanager.test');

    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'app-user-2', email: 'staff@imanager.test', displayName: 'Staff' },
            store: null,
            membership: null,
            onboardingRequired: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    await expect(fetchBackendSession(mockUser)).resolves.toEqual({
      status: 'ready',
      session: {
        user: { id: 'app-user-2', email: 'staff@imanager.test', displayName: 'Staff' },
        store: null,
        membership: null,
        onboardingRequired: true,
      },
      message: 'El backend está activo, pero el usuario todavía no tiene una tienda/membresía asignada.',
    });

    await expect(fetchBackendSession(mockUser)).resolves.toEqual({
      status: 'error',
      session: null,
      message: 'El backend respondió con un error inesperado. Reintentando.',
    });
  });

  it('returns an offline status when the request throws', async () => {
    setApiBaseUrl('https://api.imanager.test');
    vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('timeout'));

    await expect(fetchBackendSession(mockUser)).resolves.toEqual({
      status: 'offline',
      session: null,
      message: 'No se pudo conectar al backend: timeout',
    });
  });
});
