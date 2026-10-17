import { assertMemberCapacity } from '../billing/service.js';
import { storeBillingLock } from '../billing/domain.js';
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import type { FirebaseAuthContext } from "../../types/auth.js";
import { lockTransactionKey, userMembershipLockKey } from "../../lib/advisory-lock.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { buildAppSessionForUser } from "../auth/session.service.js";
import { assertSectionList, normalizeSections } from "../stores/sections.js";

const INVITATION_TTL_DAYS = 7;

export async function createInvitation(
  storeId: string,
  actorRole: string,
  email: string | undefined,
  role: "MANAGER" | "STAFF",
  access?: { sections?: string[]; sensitiveAccess?: boolean },
) {
  if (actorRole !== "OWNER") {
    throw new DomainError("Solo el Propietario puede crear invitaciones", 403);
  }

  await assertMemberCapacity(storeId);

  const frontendUrl = process.env.FRONTEND_URL?.trim();
  if (!frontendUrl) {
    throw Object.assign(
      new Error("FRONTEND_URL no está configurado en el backend. No se puede generar el enlace de invitación."),
      { statusCode: 500 }
    );
  }

  // Check if email already belongs to a member (only when email is provided)
  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email },
      include: { memberships: { where: { storeId } } },
    });
    if (existing && existing.memberships.length > 0) {
      throw new DomainError("Este email ya es miembro de la tienda", 409);
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

  const sections = access?.sections !== undefined ? assertSectionList(access.sections) : undefined;
  const invitation = await prisma.storeInvitation.create({
    data: {
      storeId,
      email,
      role,
      expiresAt,
      ...(sections !== undefined ? { sections } : {}),
      ...(access?.sensitiveAccess !== undefined ? { sensitiveAccess: access.sensitiveAccess } : {}),
    },
  });

  return {
    id: invitation.id,
    token: invitation.token,
    inviteUrl: `${frontendUrl.replace(/\/+$/, "")}/invite/${invitation.token}`,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

export async function listInvitations(storeId: string) {
  const now = new Date();
  return prisma.storeInvitation.findMany({
    where: { storeId, status: "PENDING", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
  });
}

export async function revokeInvitation(storeId: string, invitationId: string, actorRole: string) {
  if (actorRole !== "OWNER") {
    throw new DomainError("Solo el Propietario puede revocar invitaciones", 403);
  }

  const invitation = await prisma.storeInvitation.findFirst({
    where: { id: invitationId, storeId },
  });
  if (!invitation) {
    throw new DomainError("Invitación no encontrada", 404);
  }
  if (invitation.status === "REVOKED") return; // already revoked — idempotent
  if (invitation.status !== "PENDING") {
    throw new DomainError("Solo se pueden revocar invitaciones pendientes", 400);
  }

  await prisma.storeInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  });
}

export async function previewInvitation(token: string) {
  const now = new Date();
  const invitation = await prisma.storeInvitation.findUnique({
    where: { token },
    include: { store: { select: { name: true } } },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < now) {
    return null;
  }

  return {
    storeName: invitation.store.name,
    role: invitation.role,
  };
}

export async function acceptInvitation(token: string, auth: FirebaseAuthContext) {
  const now = new Date();
  const invitation = await prisma.storeInvitation.findUnique({
    where: { token },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < now) {
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
    if (!current || current.status !== "PENDING" || current.expiresAt < now) {
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

    const sections = normalizeSections(current.sections);
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

  // Return full session
  return buildAppSessionForUser(auth, invitation.storeId);
}
