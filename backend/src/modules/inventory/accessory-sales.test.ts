import { beforeEach, expect, it, vi } from 'vitest';
import { accessorySalesThisMonth } from './accessory-sales.js';

const db = vi.hoisted(() => ({ store: { findUniqueOrThrow: vi.fn() }, sale: { findMany: vi.fn() } }));
vi.mock('../../plugins/prisma.js', () => ({ prisma: db }));
vi.mock('../../lib/accounting-states.js', () => ({ storedStateFilter: async () => ({ in: ['COMPLETADA', 'PENDIENTE'] }) }));
beforeEach(() => { vi.clearAllMocks(); db.store.findUniqueOrThrow.mockResolvedValue({ timezone: 'America/Argentina/Buenos_Aires' }); });

it('suma unidades solo del mes local y consulta accesorios activos de la tienda', async () => {
  db.sale.findMany.mockResolvedValue([
    { inventoryItemId: 'cable', cantidad: 3, soldAt: new Date('2026-11-01T02:59:59Z') },
    { inventoryItemId: 'cable', cantidad: 2, soldAt: new Date('2026-11-01T03:00:00Z') },
    { inventoryItemId: 'cable', cantidad: 4, soldAt: new Date('2026-12-01T02:59:59Z') },
    { inventoryItemId: 'cable', cantidad: 8, soldAt: new Date('2026-12-01T03:00:00Z') },
  ]);
  expect(await accessorySalesThisMonth('store-ficticio', new Date('2026-11-04T12:00:00Z'))).toEqual({ month: '2026-11', sold: { cable: 6 } });
  expect(db.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ storeId: 'store-ficticio', inventoryItem: { kind: 'ACCESSORY' }, voidedAt: null, cancelledAt: null, status: { in: ['COMPLETADA', 'PENDIENTE'] } }) }));
});

it('elige el mes de la tienda incluso cuando UTC cambió de mes', async () => {
  db.sale.findMany.mockResolvedValue([]);
  expect(await accessorySalesThisMonth('store', new Date('2026-11-01T01:00:00Z'))).toEqual({ month: '2026-10', sold: {} });
});
