import { prisma } from '../../plugins/prisma.js';
import { calendarDay } from '../periodic-reports/schedule.js';

/** Only quantities, available with Stock permission even without access to Sales. */
export async function accessorySalesThisMonth(storeId: string, now = new Date()) {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { timezone: true } });
  const zone = store.timezone || 'America/Argentina/Buenos_Aires';
  const month = calendarDay(now, zone).slice(0, 7);
  // UTC envelope followed by the exact local month, including time zones with DST.
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const rows = await prisma.sale.findMany({
    where: { storeId, inventoryItem: { kind: 'ACCESSORY' }, voidedAt: null, cancelledAt: null,
      status: { in: ['COMPLETADA', 'PENDIENTE'] },
      soldAt: { gte: new Date(start.getTime() - 86_400_000), lt: new Date(end.getTime() + 86_400_000) } },
    select: { inventoryItemId: true, cantidad: true, soldAt: true },
  });
  const sold: Record<string, number> = {};
  for (const row of rows) {
    if (!row.inventoryItemId || calendarDay(row.soldAt, zone).slice(0, 7) !== month) continue;
    sold[row.inventoryItemId] = (sold[row.inventoryItemId] ?? 0) + row.cantidad;
  }
  return { month, sold };
}
