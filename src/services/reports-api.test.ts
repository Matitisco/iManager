import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('./api-client', () => api);
import { fetchReportsOverview } from './reports-api';
it.each([
  ['2026-10-01', '2026-10-22'],
  ['2026-10-26', '2026-11-01'],
])('consulta días inclusivos argentinos y conserva la señal de cancelación: %s a %s', async (start, end) => {
  const overview = { summary: { revenue: 100 } };
  api.apiRequest.mockResolvedValue({ overview });
  const user = { uid: 'u', email: null, displayName: null, getIdToken: vi.fn() };
  const signal = new AbortController().signal;
  expect(await fetchReportsOverview(user, start, end, signal)).toBe(overview);
  const path = api.apiRequest.mock.calls[0][1] as string;
  const params = new URL(`https://test.invalid${path}`).searchParams;
  expect(params.get('startDate')).toBe(`${start}T00:00:00.000-03:00`);
  expect(params.get('endDate')).toBe(`${end}T23:59:59.999-03:00`);
  expect(params.get('rangeKey')).toBe('custom');
  expect(api.apiRequest).toHaveBeenCalledWith(user, path, expect.objectContaining({ signal }));
});

it('consulta Total sin límites de fecha', async () => {
  api.apiRequest.mockResolvedValue({ overview: {} });
  const user = { uid: 'u', email: null, displayName: null, getIdToken: vi.fn() };
  await fetchReportsOverview(user);
  const path = api.apiRequest.mock.lastCall?.[1] as string;
  expect(path).toBe('/api/reports/overview?rangeKey=all_time');
});
