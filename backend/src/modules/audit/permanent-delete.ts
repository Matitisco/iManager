import { Prisma } from "@prisma/client";
import { DomainError } from "../../lib/domain-error.js";
import { isSaleCancelled } from "../../lib/accounting-states.js";
import { withSerializableRetry } from "../../lib/with-serializable-retry.js";
import { writeAudit, type Actor } from "./audit.js";
import { deviceLabel, saleCode } from "./archive.js";

const ENTITIES = {
  inventory: { table: "InventoryItem", type: "inventory" },
  sales: { table: "Sale", type: "sale" },
  clients: { table: "Client", type: "client" },
  tradeins: { table: "TradeIn", type: "trade" },
  repairs: { table: "RepairOrder", type: "repair" },
} as const;
export type PermanentDeleteEntity = keyof typeof ENTITIES;

const OWNER_ONLY = "Solo el dueño de la tienda puede borrar definitivamente.";
const INACTIVE_ONLY = "Primero anulá o archivá el registro para poder borrarlo definitivamente.";

export async function permanentlyDelete(storeId: string, entity: PermanentDeleteEntity, id: string, actor: Actor) {
  return withSerializableRetry(async tx => {
    // Recheck the actual store membership, including concurrent demotion/removal.
    const owners = await tx.$queryRaw<Array<{ role: string }>>`
      SELECT "role" FROM "StoreMember"
      WHERE "storeId" = ${storeId} AND "userId" = ${actor.userId} AND "role" = 'OWNER'
      FOR SHARE
    `;
    if (!owners.length) throw new DomainError(OWNER_ONLY, 403);
    const meta = ENTITIES[entity];
    // Table comes exclusively from the constant allowlist above, never from input.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${meta.table}"`)}
      WHERE "id" = ${id} AND "storeId" = ${storeId} FOR UPDATE`);
    const where = { id, storeId };
    let label: string;
    switch (entity) {
      case "inventory": {
        const row = await tx.inventoryItem.findFirst({ where });
        if (!row) throw new DomainError("Equipo no encontrado.", 404);
        if (!row.archivedAt) throw new DomainError(INACTIVE_ONLY, 409);
        if (await tx.consignment.findFirst({ where: { storeId, inventoryItemId: id } })) throw new DomainError('El equipo tiene historial de consignaciones y no se puede borrar definitivamente.', 409);
        label = deviceLabel(row);
        await tx.inventoryItem.delete({ where });
        break;
      }
      case "sales": {
        const row = await tx.sale.findFirst({ where });
        if (!row) throw new DomainError("Venta no encontrada.", 404);
        if (!row.voidedAt && !isSaleCancelled(row.status)) throw new DomainError(INACTIVE_ONLY, 409);
        if (await tx.consignment.findFirst({ where: { storeId, saleId: id } })) throw new DomainError('La venta cierra una consignación y no se puede borrar definitivamente.', 409);
        label = `${saleCode(row.saleNumber)} · ${row.clientName || row.deviceLabel || "Venta"}`;
        await tx.sale.delete({ where });
        break;
      }
      case "clients": {
        const row = await tx.client.findFirst({ where });
        if (!row) throw new DomainError("Cliente no encontrado.", 404);
        if (!row.archivedAt) throw new DomainError(INACTIVE_ONLY, 409);
        if (await tx.consignment.findFirst({ where: { storeId, clientId: id } })) throw new DomainError('El cliente tiene consignaciones y no se puede borrar definitivamente.', 409);
        label = row.dni ? `${row.name} · DNI ${row.dni}` : row.name;
        // ClientDeposit uses Restrict; remove the client's own dependent rows
        // explicitly, in the same transaction as the deletion and its audit.
        await tx.clientDeposit.deleteMany({ where: { storeId, clientId: id } });
        await tx.client.delete({ where });
        break;
      }
      case "tradeins": {
        const row = await tx.tradeIn.findFirst({ where });
        if (!row) throw new DomainError("Canje no encontrado.", 404);
        if (!row.voidedAt && row.confirmationStatus !== "CANCELLED" && !isSaleCancelled(row.status)) throw new DomainError(INACTIVE_ONLY, 409);
        label = `C-${String(row.tradeNumber).padStart(4, "0")} · ${row.deviceReceived}`;
        await tx.tradeIn.delete({ where });
        break;
      }
      case "repairs": {
        const row = await tx.repairOrder.findFirst({ where });
        if (!row) throw new DomainError("Orden no encontrada.", 404);
        if (!row.archivedAt) throw new DomainError(INACTIVE_ONLY, 409);
        label = `OT-${String(row.orderNumber).padStart(4, "0")} · ${row.device}`;
        await tx.repairOrder.delete({ where });
        break;
      }
    }
    await writeAudit(tx, {
      storeId, actor, actorRole: "OWNER", action: `${meta.type}.permanently_deleted`,
      entityType: meta.type, entityId: id, entityLabel: label,
      detail: `Borrado definitivo e irreversible: ${label}`,
      changes: [{ field: "status", label: "Estado", before: entity === "sales" ? "Anulada" : entity === "tradeins" ? "Anulado" : "Archivado", after: "Borrado definitivamente" }],
    });
  });
}
