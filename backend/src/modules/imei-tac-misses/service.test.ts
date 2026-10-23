import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../plugins/prisma.js', () => ({ prisma: { imeiTacMiss: { upsert: vi.fn(), findMany: vi.fn() } } }));
import { prisma } from '../../plugins/prisma.js';
import { listTacMisses, recordTacMiss } from './service.js';
beforeEach(() => vi.clearAllMocks());
describe('TAC miss persistence', () => {
  it('uses an atomic upsert and stores only TAC, count and timestamps', async () => {
    await recordTacMiss('00000001');
    expect(prisma.imeiTacMiss.upsert).toHaveBeenCalledExactlyOnceWith({ where: { tac: '00000001' }, create: { tac: '00000001' }, update: { count: { increment: 1 }, lastSeenAt: expect.any(Date) } });
  });
  it('selects only aggregate fields, ordered by count with a stable tie break', async () => {
    vi.mocked(prisma.imeiTacMiss.findMany).mockResolvedValue([]);
    expect(await listTacMisses(100)).toEqual({ items: [] });
    expect(prisma.imeiTacMiss.findMany).toHaveBeenCalledExactlyOnceWith({ select: { tac: true, count: true, firstSeenAt: true, lastSeenAt: true }, orderBy: [{ count: 'desc' }, { tac: 'asc' }], take: 100 });
  });
});
