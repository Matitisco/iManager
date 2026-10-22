import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../plugins/prisma.js';
import { listHistory } from './history.service.js';

vi.mock('../../plugins/prisma.js', () => {
  const findMany = () => ({ findMany: vi.fn(async () => []) });
  return { prisma: {
    auditEvent: findMany(), inventoryItem: findMany(), sale: findMany(), tradeIn: findMany(), client: findMany(), repairOrder: findMany(),
    supplier: findMany(), expense: findMany(), stockPurchase: findMany(), returnCase: findMany(), stockCount: findMany(),
    $queryRaw: vi.fn(async () => []),
  } };
});

const event = {
  id: 'event', storeId: 'store-a', createdAt: new Date('2026-10-22T13:42:00Z'), action: 'inventory.price', entityType: 'inventory', entityId: 'eq',
  entityLabel: 'iPhone 15 Pro 256GB · IMEI …5673', actorUserId: 'lucia', actorName: 'Lucía Fernández', actorRole: 'STAFF',
  detail: 'Precio actualizado', changes: [{ field: 'price', label: 'Precio de venta', before: '$ 1.750.000', after: '$ 1.800.000' }], reason: null, source: null,
};

beforeEach(() => {
  vi.mocked(prisma.auditEvent.findMany).mockReset();
  vi.mocked(prisma.auditEvent.findMany).mockResolvedValue([event] as never);
  vi.mocked(prisma.inventoryItem.findMany).mockReset();
  vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([]);
  vi.mocked(prisma.$queryRaw).mockReset();
  vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
});

describe('history record identifiers', () => {
  it('adds the full IMEI from the same store and keeps the saved label and differences', async () => {
    vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([{ id: 'eq', archivedAt: null, model: 'iPhone 15 Pro', capacity: '256GB', imei: '356789012345673' }] as never);
    const page = await listHistory('store-a', {});
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { storeId: 'store-a', id: { in: ['eq'] } } }));
    expect(page.events[0]).toMatchObject({ entityLabel: event.entityLabel, entityIdentifier: 'IMEI 356789012345673', changes: event.changes, recordState: 'active' });
  });
  it('does not manufacture an identifier when the record no longer exists', async () => {
    const page = await listHistory('store-a', {});
    expect(page.events[0]).toMatchObject({ entityIdentifier: null, entityLabel: event.entityLabel, recordState: 'gone' });
  });
  it('searches IMEI with a parameterized store constraint and applies existing filters', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'event' }]);
    await listHistory('store-a', { q: '356789012345673', group: 'Edición', section: 'inventory', from: new Date('2026-09-23T03:00:00Z') });
    const [sql, ...values] = vi.mocked(prisma.$queryRaw).mock.calls[0];
    expect((sql as TemplateStringsArray).join('?')).toContain('i."storeId" = ?');
    expect(values.filter(value => value === 'store-a')).toHaveLength(2);
    expect(values).toContain('%356789012345673%');
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-a', id: { in: ['event'] }, createdAt: { gte: new Date('2026-09-23T03:00:00Z') } }) }));
  });
});
