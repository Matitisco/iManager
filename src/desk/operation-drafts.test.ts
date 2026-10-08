import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../services/fetch-with-timeout';
import { fetchOperationDrafts, OperationRequestError } from '../services/operations-api';
import { DRAFT_LOAD_ERROR_MESSAGE, draftLoadNotice } from './operation-drafts';

vi.mock('../services/fetch-with-timeout', () => ({
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

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('draftLoadNotice', () => {
  beforeEach(() => {
    vi.mocked(fetchWithTimeout).mockReset();
    mockUser.getIdToken.mockResolvedValue('token-123');
    setApiBaseUrl('https://api.imanager.test');
  });

  afterEach(() => {
    setApiBaseUrl('');
  });

  it('oculta el aviso cuando la ruta de borradores responde 404', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({
      message: 'Route GET:/api/operations/inventory/drafts not found',
      error: 'Not Found',
      statusCode: 404,
    }, 404));

    const error = await fetchOperationDrafts(mockUser, 'inventory').then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(OperationRequestError);
    expect(error).toMatchObject({ status: 404, message: 'Not Found' });
    expect(draftLoadNotice(error)).toBeNull();
    expect(draftLoadNotice(new Error('Not Found'))).toBeNull();
    expect(draftLoadNotice(new OperationRequestError(404, 'No se pudo guardar la operación (404)'))).toBeNull();
    expect(draftLoadNotice('Not Found')).toBeNull();
  });

  it('muestra un mensaje amigable en español y nunca el texto crudo del servidor', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({
      error: 'Internal Server Error',
      statusCode: 500,
    }, 500));

    const error = await fetchOperationDrafts(mockUser, 'sales').then(() => null, (caught: unknown) => caught);
    const notice = draftLoadNotice(error);

    expect(notice).toBe(DRAFT_LOAD_ERROR_MESSAGE);
    expect(notice).not.toContain('Internal Server Error');
    expect(notice).not.toContain('Not Found');
    expect(draftLoadNotice(new OperationRequestError(500, 'Not Found'))).toBe(DRAFT_LOAD_ERROR_MESSAGE);
    expect(draftLoadNotice(new Error('Cannot read properties of undefined'))).toBe(DRAFT_LOAD_ERROR_MESSAGE);
    expect(draftLoadNotice(new OperationRequestError(403, 'Forbidden'))).toBe(DRAFT_LOAD_ERROR_MESSAGE);
    expect(draftLoadNotice('ECONNRESET')).toBe(DRAFT_LOAD_ERROR_MESSAGE);
  });
});
