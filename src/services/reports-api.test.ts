import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('./api-client', () => api);
import { fetchReportsOverview } from './reports-api';
it('consulta días inclusivos argentinos y conserva la señal de cancelación', async () => {
  const overview = { summary: { revenue: 100 } };
  api.apiRequest.mockResolvedValue({ overview });
  const user = { uid: 'u', email: null, displayName: null, getIdToken: vi.fn() };
  const signal = new AbortController().signal;
  expect(await fetchReportsOverview(user, '2026-10-01', '2026-10-22', signal)).toBe(overview);
  const path = api.apiRequest.mock.calls[0][1] as string;
  const params = new URL(`https://test.invalid${path}`).searchParams;
  expect(params.get('startDate')).toBe('2026-10-01T00:00:00.000-03:00');
  expect(params.get('endDate')).toBe('2026-10-22T23:59:59.999-03:00');
  expect(params.get('rangeKey')).toBe('custom');
  expect(api.apiRequest).toHaveBeenCalledWith(user, path, expect.objectContaining({ signal }));
});
