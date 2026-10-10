import { Prisma } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";
import { REPAIR_RECEIVED } from "./repairs.whatsapp.js";

// Keep this list aligned with `isRetiredRepairStatus` in src/desk/repairs.ts.
const RETIRED_REPAIR_STATUS_VALUES = ["EN_DIAGNOSTICO", "ESPERANDO_REPUESTO", "ESPERANDO_RESPUESTA"] as const;
const RETIRED_REPAIR_STATUS_LABELS = ["en diagnostico", "esperando repuesto", "esperando respuesta"];
const KEPT_REPAIR_STATUSES = new Set(["RECIBIDO", "EN_REPARACION", "LISTO_PARA_RETIRAR", "ENTREGADO"]);

export function normalizeRepairStatusLabel(label: string) {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function isRetiredRepairStatus(value: string, label?: string | null) {
  if (KEPT_REPAIR_STATUSES.has(value)) return false;
  if ((RETIRED_REPAIR_STATUS_VALUES as readonly string[]).includes(value)) return true;
  if (label && RETIRED_REPAIR_STATUS_LABELS.includes(normalizeRepairStatusLabel(label))) return true;
  return false;
}

// Idempotent: orders already in Recibido and catalogs without these options are left untouched.
// Historical RepairStatusEvent rows stay as they were; the move only appends Recibido.
export async function retireRepairStatuses(storeId: string) {
  const options = await prisma.storeCatalogOption.findMany({
    where: { storeId, kind: "REPAIR_STATUS" },
    select: { id: true, value: true, label: true },
  });
  const retiredValues = new Set<string>(RETIRED_REPAIR_STATUS_VALUES);
  const optionIds: string[] = [];
  for (const option of options) {
    if (!isRetiredRepairStatus(option.value, option.label)) continue;
    retiredValues.add(option.value);
    optionIds.push(option.id);
  }
  const values = [...retiredValues];
  const pendingOrder = await prisma.repairOrder.findFirst({
    where: { storeId, status: { in: values } },
    select: { id: true },
  });
  if (!pendingOrder && optionIds.length === 0) return { moved: 0, removed: 0 };

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM "RepairOrder" WHERE "storeId" = ${storeId} AND "status" IN (${Prisma.join(values)}) FOR UPDATE`,
    );
    let moved = 0;
    for (const row of locked) {
      const updated = await tx.repairOrder.updateMany({
        where: { id: row.id, status: { in: values } },
        data: { status: REPAIR_RECEIVED },
      });
      if (updated.count !== 1) continue;
      await tx.repairStatusEvent.create({ data: { storeId, orderId: row.id, status: REPAIR_RECEIVED } });
      moved += 1;
    }
    const removed = optionIds.length
      ? (await tx.storeCatalogOption.deleteMany({ where: { id: { in: optionIds } } })).count
      : 0;
    return { moved, removed };
  });
}
