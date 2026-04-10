import { prisma } from "../../plugins/prisma.js";
import type { FirebaseAuthContext } from "../../types/auth.js";
import { findOrCreateUserFromFirebase } from "../users/users.service.js";
import { buildAppSessionForUser } from "../auth/session.service.js";

const INVITATION_TTL_DAYS = 7;

export async function createInvitation(storeId: string, actorRole: string, email: string | undefined, role: "ADMIN" | "SELLER") {
  if (actorRole !== "OWNER") {
    throw Object.assign(new Error("Solo el Propietario puede crear invitaciones"), { statusCode: 403 });
  }

  // Check if email already belongs to a member (only when email is provided)
  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email },
      include: { memberships: { where: { storeId } } },
    });
    if (existing && existing.memberships.length > 0) {
      throw Object.assign(new Error("Este email ya es miembro de la tienda"), { statusCode: 409 });
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

  const invitation = await prisma.storeInvitation.create({
    data: { storeId, email, role, expiresAt },
  });

  const frontendUrl = process.env.FRONTEND_URL ?? "https://imanager.app";
  return {
    id: invitation.id,
    token: invitation.token,
    inviteUrl: `${frontendUrl}/invite/${invitation.token}`,
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
    throw Object.assign(new Error("Solo el Propietario puede revocar invitaciones"), { statusCode: 403 });
  }

  const invitation = await prisma.storeInvitation.findFirst({
    where: { id: invitationId, storeId },
  });
  if (!invitation) {
    throw Object.assign(new Error("Invitación no encontrada"), { statusCode: 404 });
  }
  if (invitation.status === "REVOKED") return; // already revoked — idempotent
  if (invitation.status !== "PENDING") {
    throw Object.assign(new Error("Solo se pueden revocar invitaciones pendientes"), { statusCode: 400 });
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
    throw Object.assign(new Error("La invitación expiró o ya fue utilizada"), { statusCode: 410 });
  }

  // Find or create the User in PG
  const user = await findOrCreateUserFromFirebase(auth);

  // Check if already a member (idempotent)
  const existingMember = await prisma.storeMember.findUnique({
    where: { storeId_userId: { storeId: invitation.storeId, userId: user.id } },
  });

  if (!existingMember) {
    // Check if user has any existing membership to determine isDefault
    const hasMemberships = await prisma.storeMember.count({ where: { userId: user.id } });

    await prisma.storeMember.create({
      data: {
        storeId: invitation.storeId,
        userId: user.id,
        role: invitation.role,
        isDefault: hasMemberships === 0,
      },
    });
  }

  // Mark invitation as accepted
  await prisma.storeInvitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED" },
  });

  // Return full session
  return buildAppSessionForUser(auth);
}
