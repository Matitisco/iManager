import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn());
vi.mock('../../plugins/prisma.js', () => ({ prisma: { $queryRaw: query } }));
import { listSectionChanges, markSectionViewed } from './service.js';

beforeEach(() => { query.mockReset(); });
describe('section views service', () => {
  it('does not query for an empty visit', async () => {
    expect(await markSectionViewed('s', 'u', 'clients', [])).toEqual({ viewed: [] });
    expect(query).not.toHaveBeenCalled();
  });
  it('serializes exact versions consistently for clients and receipts', async () => {
    const updatedAt = new Date('2026-10-22T12:00:00.123Z');
    query.mockResolvedValue([{ id: 'c', updatedAt }]);
    expect(await listSectionChanges('s', 'u', 'clients')).toEqual([{ id: 'c', updatedAt: updatedAt.toISOString() }]);
    expect(await markSectionViewed('s', 'u', 'clients', [{ id: 'c', updatedAt: updatedAt.toISOString() }])).toEqual({ viewed: [{ id: 'c', updatedAt: updatedAt.toISOString() }] });
  });
});
