import { beforeEach, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { fetchPeriodicReport, sendPeriodicReportTest } from './periodic-report-api';

vi.mock('./api-client', () => ({ apiRequest: vi.fn() }));
const user = { uid: 'owner', email: 'owner@test.local', displayName: 'Owner', getIdToken: vi.fn() };
beforeEach(() => vi.resetAllMocks());

it('forwards load cancellation to the HTTP client', async () => {
  const controller = new AbortController();
  vi.mocked(apiRequest).mockResolvedValue({ settings: { frequency: 'WEEKLY' } });
  await expect(fetchPeriodicReport(user, controller.signal)).resolves.toEqual({ frequency: 'WEEKLY' });
  expect(apiRequest).toHaveBeenCalledWith(user, '/api/stores/current/periodic-report', expect.objectContaining({ signal: controller.signal }));
});

it('posts the test draft with cancellation and enough time for the provider deadline', async () => {
  const controller = new AbortController();
  const input = { enabled: false, frequency: 'MONTHLY' as const, recipients: ['draft@test.local'] };
  vi.mocked(apiRequest).mockResolvedValue({ sent: true, message: 'Mail de prueba enviado' });
  await expect(sendPeriodicReportTest(user, input, controller.signal)).resolves.toMatchObject({ sent: true });
  expect(apiRequest).toHaveBeenCalledExactlyOnceWith(user, '/api/stores/current/periodic-report/test', expect.objectContaining({ method: 'POST', body: input, signal: controller.signal, timeoutMs: 30000 }));
});
