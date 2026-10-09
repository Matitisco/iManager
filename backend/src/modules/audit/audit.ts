import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

export type Actor = {
  userId: string;
  name: string;
};

type AuditDb = Prisma.TransactionClient | PrismaClient;

export async function loadActor(userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });
  const name = user?.displayName?.trim() || user?.email?.trim() || "Usuario";
  return { userId, name: name.slice(0, 255) };
}

export function cancellationStamp(actor?: Actor | null) {
  if (!actor) return {};
  return {
    cancelledBy: actor.name,
    cancelledAt: new Date(),
  };
}

export async function writeAudit(
  db: AuditDb,
  event: {
    storeId: string;
    actor: Actor;
    action: string;
    entityType: string;
    entityId: string;
    detail?: string | null;
  },
) {
  await db.auditEvent.create({
    data: {
      storeId: event.storeId,
      actorUserId: event.actor.userId,
      actorName: event.actor.name,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      detail: event.detail ?? null,
    },
  });
}

export function moneyChanged(current: { toString(): string } | number | null | undefined, next: number) {
  const left = Number(current == null ? NaN : typeof current === "number" ? current : current.toString());
  if (!Number.isFinite(left) || !Number.isFinite(next)) return true;
  return left.toFixed(2) !== next.toFixed(2);
}
