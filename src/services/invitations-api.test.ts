import { describe, expect, it, vi } from 'vitest';
import {
  resolveInvitationPreview,
  type InvitationPreview,
} from './invitations-api';

vi.mock('./backend-session', () => ({
  getBackendBaseUrl: () => 'https://api.imanager.test',
}));

function createJsonResponse(body: InvitationPreview, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('resolveInvitationPreview', () => {
  it('returns the preview on the first successful attempt', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      createJsonResponse({ storeName: 'Tienda Centro', role: 'MANAGER' })
    );

    await expect(resolveInvitationPreview('token-1', { fetcher })).resolves.toEqual({
      kind: 'valid',
      preview: { storeName: 'Tienda Centro', role: 'MANAGER' },
      attempts: 1,
    });
  });

  it('retries after an AbortError and eventually resolves', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(createJsonResponse({ storeName: 'Tienda Norte', role: 'STAFF' }));

    await expect(
      resolveInvitationPreview('token-2', { fetcher, retryDelayMs: 0 })
    ).resolves.toEqual({
      kind: 'valid',
      preview: { storeName: 'Tienda Norte', role: 'STAFF' },
      attempts: 2,
    });
  });

  it('retries after a network error and eventually resolves', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(createJsonResponse({ storeName: 'Tienda Oeste', role: 'MANAGER' }));

    await expect(
      resolveInvitationPreview('token-2b', { fetcher, retryDelayMs: 0 })
    ).resolves.toEqual({
      kind: 'valid',
      preview: { storeName: 'Tienda Oeste', role: 'MANAGER' },
      attempts: 2,
    });
  });

  it('retries after a 503 response and eventually resolves', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(createJsonResponse({ storeName: 'Tienda Sur', role: 'MANAGER' }));

    await expect(
      resolveInvitationPreview('token-3', { fetcher, retryDelayMs: 0 })
    ).resolves.toEqual({
      kind: 'valid',
      preview: { storeName: 'Tienda Sur', role: 'MANAGER' },
      attempts: 2,
    });
  });

  it('does not retry invalid invitations and returns invalid immediately', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));

    await expect(resolveInvitationPreview('token-4', { fetcher })).resolves.toEqual({
      kind: 'invalid',
      attempts: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns a technical error after exhausting retries', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      resolveInvitationPreview('token-5', { fetcher, retryDelayMs: 0, retries: 2 })
    ).resolves.toEqual({
      kind: 'error',
      message: 'Error al verificar invitación',
      attempts: 3,
    });
  });
});
