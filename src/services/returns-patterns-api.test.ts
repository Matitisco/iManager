import { describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { fetchReturnAnalysis, fetchReturnPatterns } from './returns-api';
vi.mock('./api-client', () => ({ apiRequest: vi.fn() }));
const user = { uid: 'test', email: 'owner@example.test', displayName: 'Owner', getIdToken: async () => 'test-token' };

describe('return patterns contract', () => {
  it.each(['supplier', 'purchase', 'model'] as const)('requests %s groups through the authenticated API client', async groupBy => {
    const patterns = [{ key: 'group', percent: 36, hot: true, claimsDetail: [], topReason: null }];
    vi.mocked(apiRequest).mockResolvedValueOnce({ patterns });
    expect(await fetchReturnPatterns(user, groupBy)).toEqual(patterns);
    expect(apiRequest).toHaveBeenLastCalledWith(user, `/api/returns/patterns?groupBy=${groupBy}`, expect.any(Object));
  });
  it('keeps the exact server summary alongside the complete ranking', async () => {
    const response = { patterns: [], summary: { devices: 90, problems: 16, percent: 18, claims: 20, topReason: null } };
    vi.mocked(apiRequest).mockResolvedValueOnce(response);
    expect(await fetchReturnAnalysis(user, 'model')).toEqual(response);
  });
  it('propagates a failure instead of returning fallback data', async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Unavailable'));
    await expect(fetchReturnPatterns(user, 'purchase')).rejects.toThrow('Unavailable');
  });
});
