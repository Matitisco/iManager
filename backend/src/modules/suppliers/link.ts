import type { Prisma } from "@prisma/client";
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import { writeAudit, type Actor } from "../audit/audit.js";

type Db = Prisma.TransactionClient;

async function activeSupplier(db: Db, storeId: string, supplierId: string) {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, storeId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!supplier) throw new DomainError("Ese proveedor no está en esta tienda", 404);
  return supplier;
}

/** Point one device at a supplier. A new one-item purchase keeps the history. */
export async function assignItemSupplier(
  db: Db,
  storeId: string,
  itemId: string,
  supplierId: string | null,
  actor?: Actor | null,
) {
  const item = await db.inventoryItem.findFirst({
    where: { id: itemId, storeId },
    select: { id: true, model: true, capacity: true, supplierId: true, stockPurchaseId: true },
  });
  if (!item) throw new DomainError("No encontramos el equipo", 404);
  const label = [item.model, item.capacity].filter(Boolean).join(" ") || "el equipo";

  if (!supplierId) {
    if (!item.supplierId && !item.stockPurchaseId) return { supplierName: null, purchaseId: null };
    await db.inventoryItem.update({ where: { id: itemId }, data: { supplierId: null, stockPurchaseId: null } });
    if (actor) {
      await writeAudit(db, {
        storeId,
        actor,
        action: "inventory.supplier",
        entityType: "inventory",
        entityId: itemId,
        entityLabel: label,
        detail: `El equipo ${label} quedó sin proveedor.`,
      });
    }
    return { supplierName: null, purchaseId: null };
  }

  const supplier = await activeSupplier(db, storeId, supplierId);
  if (item.supplierId === supplierId && item.stockPurchaseId) {
    return { supplierName: supplier.name, purchaseId: item.stockPurchaseId };
  }

  let purchaseId = item.stockPurchaseId;
  if (purchaseId) {
    const siblings = await db.inventoryItem.count({
      where: { storeId, stockPurchaseId: purchaseId, id: { not: itemId }, archivedAt: null },
    });
    if (siblings === 0) {
      await db.stockPurchase.update({ where: { id: purchaseId }, data: { supplierId } });
    } else {
      purchaseId = null;
    }
  }
  if (!purchaseId) {
    const purchase = await db.stockPurchase.create({
      data: { storeId, supplierId, purchasedAt: new Date() },
    });
    purchaseId = purchase.id;
    if (actor) {
      await writeAudit(db, {
        storeId,
        actor,
        action: "purchase.created",
        entityType: "supplier",
        entityId: supplier.id,
        entityLabel: supplier.name,
        detail: `Quedó registrada la compra de ${label} a ${supplier.name}.`,
      });
    }
  }
  await db.inventoryItem.update({ where: { id: itemId }, data: { supplierId, stockPurchaseId: purchaseId } });
  if (actor && item.supplierId !== supplierId) {
    await writeAudit(db, {
      storeId,
      actor,
      action: "inventory.supplier",
      entityType: "inventory",
      entityId: itemId,
      entityLabel: label,
      detail: `El equipo ${label} vino de ${supplier.name}.`,
    });
  }
  return { supplierName: supplier.name, purchaseId };
}

/** One purchase for a whole uploaded list. Devices that already have a supplier stay as they are. */
export async function attachItemsToPurchase(
  storeId: string,
  supplierId: string,
  itemIds: string[],
  actor?: Actor | null,
) {
  const ids = [...new Set(itemIds)];
  if (!ids.length) return null;
  return prisma.$transaction(async (tx) => {
    const supplier = await activeSupplier(tx, storeId, supplierId);
    const purchase = await tx.stockPurchase.create({
      data: { storeId, supplierId, purchasedAt: new Date(), notes: "Compra cargada desde un listado." },
    });
    const linked = await tx.inventoryItem.updateMany({
      where: { storeId, id: { in: ids }, supplierId: null, archivedAt: null },
      data: { supplierId, stockPurchaseId: purchase.id },
    });
    if (actor) {
      const count = linked.count;
      await writeAudit(tx, {
        storeId,
        actor,
        action: "purchase.created",
        entityType: "supplier",
        entityId: supplier.id,
        entityLabel: supplier.name,
        detail: count === 1
          ? `Quedó registrada la compra de 1 equipo a ${supplier.name}.`
          : `Quedó registrada la compra de ${count} equipos a ${supplier.name}.`,
      });
    }
    return purchase;
  });
}
