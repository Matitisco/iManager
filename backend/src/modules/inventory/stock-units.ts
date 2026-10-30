import type { InventoryItem, Prisma } from '@prisma/client';
import { DomainError } from '../../lib/domain-error.js';

export function saleUnits(cantidad = 1, item?: Pick<InventoryItem, 'cantidad' | 'imei'> | null) {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 2147483647) throw new DomainError('La cantidad debe ser un entero positivo', 400);
  if (item?.imei && cantidad !== 1) throw new DomainError('Los equipos con IMEI solo pueden venderse de a uno', 400);
  if (item && cantidad > (item.cantidad ?? 1)) throw new DomainError('No hay unidades suficientes en stock', 409);
  return cantidad;
}

/** Call after locking the inventory row in the transaction. */
export async function takeStock(tx: Prisma.TransactionClient, item: InventoryItem, cantidad = 1) {
  saleUnits(cantidad, item);
  const remaining = (item.cantidad ?? 1) - cantidad;
  return tx.inventoryItem.update({ where: { id: item.id }, data: {
    cantidad: remaining, status: remaining === 0 ? 'VENDIDO' : 'DISPONIBLE',
    pendingSaleRegistration: false, previousSaleStatus: null,
  } });
}

/** Old sales never decremented stock. Preserve their cancellation behavior. */
export async function releaseStock(tx: Prisma.TransactionClient, storeId: string, sale: { inventoryItemId: string | null; cantidad?: number; stockDeducted?: boolean; previousInventoryStatus?: string | null; previousPendingSaleRegistration?: boolean | null }) {
  if (!sale.inventoryItemId) return;
  let status = sale.previousInventoryStatus ?? 'DISPONIBLE';
  if (sale.stockDeducted) {
    await tx.$queryRaw`SELECT "id" FROM "InventoryItem" WHERE "id" = ${sale.inventoryItemId} AND "storeId" = ${storeId} FOR UPDATE`;
    const current = await tx.inventoryItem.findFirstOrThrow({ where: { id: sale.inventoryItemId, storeId } });
    status = current.reservedDepositId ? 'RESERVADO' : 'DISPONIBLE';
  }
  return tx.inventoryItem.update({ where: { id: sale.inventoryItemId, storeId }, data: {
    ...(sale.stockDeducted ? { cantidad: { increment: sale.cantidad ?? 1 } } : {}),
    status,
    pendingSaleRegistration: sale.previousPendingSaleRegistration ?? false,
  } });
}
