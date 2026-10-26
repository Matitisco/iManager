import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../plugins/prisma.js";

import type { AuditChange } from "./diff-fields.js";

export type Actor = {
  userId: string;
  name: string;
  role?: string | null;
};

export type AuditSource = "app" | "bulk" | "import" | "system";

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

export async function actorFor(member: { userId: string; role?: string | null }): Promise<Actor> {
  const actor = await loadActor(member.userId);
  return { ...actor, role: member.role ?? null };
}

export async function writeAudit(
  db: AuditDb,
  event: {
    storeId: string;
    actor?: Actor | null;
    action: string;
    entityType: string;
    entityId: string;
    detail?: string | null;
    entityLabel?: string | null;
    changes?: AuditChange[] | null;
    reason?: string | null;
    actorRole?: string | null;
    source?: AuditSource | null;
  },
) {
  const changes = event.changes?.filter((change) => change.before !== change.after) ?? [];
  await db.auditEvent.create({
    data: {
      storeId: event.storeId,
      actorUserId: event.actor?.userId ?? null,
      actorName: (event.actor?.name || "Sistema").slice(0, 255),
      action: event.action.slice(0, 40),
      entityType: event.entityType.slice(0, 40),
      entityId: event.entityId.slice(0, 120),
      detail: event.detail ?? null,
      entityLabel: event.entityLabel ? event.entityLabel.slice(0, 160) : null,
      changes: changes.length ? (changes as Prisma.InputJsonValue) : undefined,
      reason: event.reason?.trim() ? event.reason.trim().slice(0, 280) : null,
      actorRole: (event.actorRole ?? event.actor?.role ?? null)?.slice(0, 20) ?? null,
      source: event.source ?? (event.actor ? "app" : "system"),
    },
  });
}

export function moneyChanged(current: { toString(): string } | number | null | undefined, next: number | null) {
  if (current == null || next == null) return current != null || next != null;
  const left = Number(current == null ? NaN : typeof current === "number" ? current : current.toString());
  if (!Number.isFinite(left) || !Number.isFinite(next)) return true;
  return left.toFixed(2) !== next.toFixed(2);
}
