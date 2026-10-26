import type { Prisma } from "@prisma/client";

export const returnRecognitionSelect = {
  settlement: true,
  resolvedAt: true,
  creditNote: { select: { createdAt: true } },
  events: {
    where: { status: { in: ["EN_PROVEEDOR", "RESUELTO"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 1,
    select: { status: true, createdAt: true },
  },
} satisfies Prisma.ReturnCaseSelect;

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
  const issued = claim.events.find(event => event.status === "EN_PROVEEDOR" || event.status === "RESUELTO");
  // Respaldo para registros históricos sin evento de emisión.
  return issued?.createdAt ?? claim.resolvedAt;
}
