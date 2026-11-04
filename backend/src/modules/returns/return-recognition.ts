import { normalizeAccountingState, storedStateFilter } from '../../lib/accounting-states.js';
import type { Prisma } from "@prisma/client";

export async function returnRecognitionSelect(tx: Prisma.TransactionClient, storeId: string) { return {
  settlement: true,
  resolvedAt: true,
  creditNote: { select: { createdAt: true } },
  events: {
    where: { storeId, status: await storedStateFilter(tx, 'ReturnEvent', storeId, ['EN_PROVEEDOR', 'RESUELTO']) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 1,
    select: { status: true, createdAt: true },
  },
} satisfies Prisma.ReturnCaseSelect; }

type CompensationRecord = {
  settlement: string | null;
  resolvedAt: Date | null;
  creditNote: { createdAt: Date } | null;
  events: Array<{ status: string; createdAt: Date }>;
};

/** La compensación se emite al resolver, aunque el equipo siga en RMA. */
export function returnCompensatedAt(claim: CompensationRecord): Date | null {
  if (claim.settlement !== "NOTA_CREDITO" && claim.settlement !== "REINTEGRO") return null;
  if (claim.settlement === "NOTA_CREDITO" && claim.creditNote) return claim.creditNote.createdAt;
  const issued = claim.events.find(event => ['EN_PROVEEDOR', 'RESUELTO'].includes(normalizeAccountingState('returnEvent', event.status)));
  // Respaldo para registros históricos sin evento de emisión.
  return issued?.createdAt ?? claim.resolvedAt;
}
