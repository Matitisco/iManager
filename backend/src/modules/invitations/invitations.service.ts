import { track } from '../analytics/track.js';
import { assertMemberCapacity } from '../billing/service.js';
import { storeBillingLock } from '../billing/domain.js';
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import type { FirebaseAuthContext } from "../../types/auth.js";
import { lockTransactionKey, userMembershipLockKey } from "../../lib/advisory-lock.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { buildAppSessionForUser } from "../auth/session.service.js";
import { assertSectionList, normalizeSections, STAFF_DEFAULT_SECTIONS } from "../stores/sections.js";

const INVITATION_TTL_DAYS = 7;

export async function createInvitation(
  storeId: string,
  actorRole: string,
  email: string | undefined,
  role: "MANAGER" | "STAFF",
  access?: { sections?: string[]; sensitiveAccess?: boolean },
  actorUserId?: string,
) {
  if (actorRole !== "OWNER" && !(actorRole === "MANAGER" && role === "STAFF")) {
    throw new DomainError("No tenés permisos para invitar con ese rol", 403);
  }

  await assertMemberCapacity(storeId);

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (!frontendUrl) {
    throw Object.assign(
      new Error("FRONTEND_URL no está configurado en el backend. No se puede generar el enlace de invitación."),
      { statusCode: 500 }
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

  const sections = access?.sections !== undefined ? assertSectionList(access.sections) : undefined;
  const invitation = await prisma.storeInvitation.create({
    data: {
      storeId,
      ...(actorUserId ? { invitedById: actorUserId } : {}),
      email,
      role,
      expiresAt,
      ...(sections !== undefined ? { sections } : {}),
      ...(access?.sensitiveAccess !== undefined ? { sensitiveAccess: access.sensitiveAccess } : {}),
    },
  });

  void (async () => {
    const nth = await prisma.storeInvitation.count({ where: { storeId } });
    await track({ name: 'invite_created', storeId, userId: actorUserId, props: { role, nth } });
  })().catch(() => undefined);
  return {
    id: invitation.id,
    token: invitation.token,
    inviteUrl: `${frontendUrl.replace(/\/+$/, "")}/invite/${invitation.token}`,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

export async function listInvitations(storeId: string) {
  const now = new Date();
  const invitations = await prisma.storeInvitation.findMany({
    where: { storeId, status: "PENDING", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, email: true, role: true, createdAt: true, expiresAt: true },
  });
  const base = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");
  if (!base) throw new DomainError("No se puede generar el enlace de invitación", 500);
  return invitations.map(({ token, ...invite }) => ({ ...invite, inviteUrl: `${base}/invite/${token}` }));
}

export async function revokeInvitation(storeId: string, invitationId: string, actorRole: string) {
  if (actorRole !== "OWNER" && actorRole !== "MANAGER") {
    throw new DomainError("No tenés permisos para cancelar invitaciones", 403);
  }

  const invitation = await prisma.storeInvitation.findFirst({
    where: { id: invitationId, storeId },
  });
  if (!invitation) {
    throw new DomainError("Invitación no encontrada", 404);
  }
  if (actorRole === "MANAGER" && invitation.role !== "STAFF") {
    throw new DomainError("Solo podés cancelar invitaciones para Empleado", 403);
  }
  if (invitation.status === "REVOKED") return; // already revoked — idempotent
  if (invitation.status !== "PENDING") {
    throw new DomainError("Solo se pueden revocar invitaciones pendientes", 400);
  }

  await prisma.$transaction(async tx => {
    await lockTransactionKey(tx, `invitation:${invitation.id}`);
    const current = await tx.storeInvitation.findUnique({ where: { id: invitation.id } });
    if (current?.status === "REVOKED") return;
    if (current?.status !== "PENDING") throw new DomainError("Solo se pueden revocar invitaciones pendientes", 400);
    await tx.storeInvitation.update({ where: { id: invitation.id }, data: { status: "REVOKED" } });
  });
}

export async function previewInvitation(token: string) {
  const now = new Date();
  const invitation = await prisma.storeInvitation.findUnique({
    where: { token },
    include: { store: { select: { name: true } } },
  });

  if (!invitation) return { status: "not_found" as const };
  if (invitation.status === "ACCEPTED") return { status: "used" as const };
  if (invitation.status === "REVOKED") return { status: "revoked" as const };
  if (invitation.expiresAt <= now) return { status: "expired" as const };

  const inviter = invitation.invitedById
    ? await prisma.user.findUnique({ where: { id: invitation.invitedById }, select: { displayName: true } })
    : null;
  const owner = !inviter?.displayName ? await prisma.storeMember.findFirst({
    where: { storeId: invitation.storeId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { displayName: true } } },
  }) : null;
  return {
    status: "valid" as const,
    storeName: invitation.store.name,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    inviterName: inviter?.displayName || owner?.user.displayName || "El propietario",
  };
}

export async function acceptInvitation(token: string, auth: FirebaseAuthContext) {
  const now = new Date();
  const invitation = await prisma.storeInvitation.findUnique({
    where: { token },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= now) {
    throw new DomainError("La invitación expiró o ya fue utilizada", 410);
  }

  // Find or create the User in PG
  const user = await findOrCreateUserFromFirebase(auth);

  const existingMember = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId: invitation.storeId, userId: user.id } },
  });

  if (existingMember) {
    throw Object.assign(
      new Error("Ya formás parte de esta tienda. El creador o un miembro existente no puede usar este enlace."),
      { statusCode: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await lockTransactionKey(tx, userMembershipLockKey(user.id));
    await lockTransactionKey(tx, `invitation:${invitation.id}`);

    const current = await tx.storeInvitation.findUnique({ where: { id: invitation.id } });
    if (!current || current.status !== "PENDING" || current.expiresAt <= new Date()) {
      throw new DomainError("La invitación expiró o ya fue utilizada", 410);
    }

    const memberNow = await tx.storeMember.findUnique({
      where: { storeId_userId: { storeId: invitation.storeId, userId: user.id } },
    });
    if (memberNow) {
      throw Object.assign(
        new Error("Ya formás parte de esta tienda. El creador o un miembro existente no puede usar este enlace."),
        { statusCode: 409 }
      );
    }

    await lockTransactionKey(tx, storeBillingLock(invitation.storeId));
    await assertMemberCapacity(invitation.storeId, tx);

    const membershipCount = await tx.storeMember.count({ where: { userId: user.id } });

    const sections = normalizeSections(current.sections) ?? (current.role === "STAFF" ? STAFF_DEFAULT_SECTIONS : null);
    await tx.storeMember.create({
      data: {
        storeId: invitation.storeId,
        userId: user.id,
        role: current.role,
        isDefault: membershipCount === 0,
        ...(sections ? { sections } : {}),
        ...(typeof current.sensitiveAccess === "boolean" ? { sensitiveAccess: current.sensitiveAccess } : {}),
      },
    });

    await tx.storeMember.updateMany({
      where: { userId: user.id, NOT: { storeId: invitation.storeId }, isDefault: true },
      data: { isDefault: false },
    });

    await tx.storeMember.updateMany({
      where: { userId: user.id, storeId: invitation.storeId },
      data: { isDefault: true },
    });

    await tx.storeInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });
  });

  void track({ name: 'invite_accepted', storeId: invitation.storeId, userId: user.id, props: { role: invitation.role, hoursToAccept: Math.max(0, (now.getTime() - invitation.createdAt.getTime()) / 3600000) }, dedupeKey: `invite_acc:${invitation.id}` });
  // Return full session
  return buildAppSessionForUser(auth, invitation.storeId);
}
