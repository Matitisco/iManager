import { prisma } from "../../plugins/prisma.js";
import type { StoreRole } from "@prisma/client";

export async function getDefaultMembershipForUser(userId: string) {
  return prisma.storeMember.findFirst({
    where: { userId },
    include: { store: true },
    orderBy: { isDefault: "desc" },
  });
}

export async function getMembershipForUserAndStore(userId: string, storeId: string) {
  return prisma.storeMember.findFirst({
    where: { userId, storeId },
    include: { store: true },
  });
}

export interface StoreUpdateInput {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  timezone?: string;
}

export async function updateStore(storeId: string, data: StoreUpdateInput) {
  return prisma.store.update({
    where: { id: storeId },
    data,
  });
}

export async function listMembers(storeId: string) {
  const members = await prisma.storeMember.findMany({
    where: { storeId },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    isDefault: m.isDefault,
    createdAt: m.createdAt,
    user: m.user,
  }));
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  newRole: StoreRole,
  actorRole: StoreRole,
  actorUserId: string
) {
  if (actorRole !== "OWNER" && actorRole !== "MANAGER") {
    throw Object.assign(new Error("No tenés permisos para gestionar el equipo"), { statusCode: 403 });
  }

  const target = await prisma.storeMember.findFirst({ where: { id: memberId, storeId } });
  if (!target) {
    throw Object.assign(new Error("Miembro no encontrado"), { statusCode: 404 });
  }

  // MANAGER cannot touch OWNERs
  if (actorRole === "MANAGER" && target.role === "OWNER") {
    throw Object.assign(new Error("No podés modificar el rol de un Propietario"), { statusCode: 403 });
  }
  // MANAGER cannot assign OWNER role
  if (actorRole === "MANAGER" && newRole === "OWNER") {
    throw Object.assign(new Error("No podés asignar el rol Propietario"), { statusCode: 403 });
  }

  // Cannot leave store without an OWNER
  if (target.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await prisma.storeMember.count({ where: { storeId, role: "OWNER" } });
    if (ownerCount <= 1) {
      throw Object.assign(new Error("No puede haber una tienda sin Propietario"), { statusCode: 400 });
    }
  }

  return prisma.storeMember.update({ where: { id: memberId }, data: { role: newRole } });
}

export async function removeMember(
  storeId: string,
  memberId: string,
  actorRole: StoreRole,
  actorUserId: string
) {
  if (actorRole !== "OWNER" && actorRole !== "MANAGER") {
    throw Object.assign(new Error("No tenés permisos para gestionar el equipo"), { statusCode: 403 });
  }

  const target = await prisma.storeMember.findFirst({
    where: { id: memberId, storeId },
    include: { user: true },
  });
  if (!target) {
    throw Object.assign(new Error("Miembro no encontrado"), { statusCode: 404 });
  }

  // MANAGER cannot remove OWNERs
  if (actorRole === "MANAGER" && target.role === "OWNER") {
    throw Object.assign(new Error("No podés remover a un Propietario"), { statusCode: 403 });
  }

  // Cannot remove the only OWNER
  if (target.role === "OWNER") {
    const ownerCount = await prisma.storeMember.count({ where: { storeId, role: "OWNER" } });
    if (ownerCount <= 1) {
      throw Object.assign(new Error("No puede haber una tienda sin Propietario"), { statusCode: 400 });
    }
  }

  await prisma.storeMember.delete({ where: { id: memberId } });
}
