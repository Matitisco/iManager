import { trialData } from '../billing/domain.js';
import { DomainError } from "../../lib/domain-error.js";
import { prisma } from "../../plugins/prisma.js";
import type { StoreRole } from "@prisma/client";
import { lockTransactionKey, userMembershipLockKey } from "../../lib/advisory-lock.js";
import { assertStoreContact, blankToNull } from "./store-contact.js";
import { assertSectionList, normalizeSections } from "./sections.js";
import { asCurrency, asExchangeMode, asExchangeSource, positiveRate } from "../../lib/money-currency.js";
import { assertManualQuoteOrder } from "../../lib/manual-quote.js";

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

export interface UserStoreSummary {
  id: string;
  name: string;
  role: StoreRole;
  isDefault: boolean;
}

export async function listStoresForUser(userId: string): Promise<UserStoreSummary[]> {
  const memberships = await prisma.storeMember.findMany({
    where: { userId },
    include: {
      store: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return memberships.map((membership) => ({
    id: membership.store.id,
    name: membership.store.name,
    role: membership.role,
    isDefault: membership.isDefault,
  }));
}

export async function createStoreForUser(userId: string, storeName: string) {
  const name = storeName.trim();
  if (!name) {
    throw new DomainError("El nombre de la tienda es obligatorio", 400);
  }

  return prisma.$transaction(async (tx) => {
    await lockTransactionKey(tx, userMembershipLockKey(userId));
    const existingCount = await tx.storeMember.count({ where: { userId } });

    if (existingCount > 0) {
      await tx.storeMember.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const account = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const store = await tx.store.create({
      data: { name, ...trialData(account.billingLegacy) },
    });

    const membership = await tx.storeMember.create({
      data: {
        storeId: store.id,
        userId,
        role: "OWNER",
        isDefault: true,
      },
    });

    return { store, membership };
  });
}

export async function activateStoreForUser(userId: string, storeId: string) {
  const membership = await prisma.storeMember.findFirst({
    where: { userId, storeId },
  });

  if (!membership) {
    throw new DomainError("No pertenecés a esa tienda", 404);
  }

  await prisma.$transaction([
    prisma.storeMember.updateMany({
      where: { userId },
      data: { isDefault: false },
    }),
    prisma.storeMember.update({
      where: { id: membership.id },
      data: { isDefault: true },
    }),
  ]);

  return membership;
}

export interface StoreUpdateInput {
  name?: string;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  address?: string | null;
  currency?: string;
  exchangeMode?: string;
  exchangeSource?: string;
  manualBuy?: number | null;
  manualSell?: number | null;
  timezone?: string;
  usedWarrantyDays?: number;
  sealedWarrantyDays?: number;
  repairWarrantyDays?: number;
}

export async function updateStore(storeId: string, data: StoreUpdateInput) {
  const contact = assertStoreContact(data);
  await assertManualQuoteUpdate(storeId, data);
  return prisma.store.update({
    where: { id: storeId },
    data: {
      ...("name" in data ? { name: data.name } : {}),
      ...("timezone" in data ? { timezone: data.timezone } : {}),
      ...("currency" in data ? { currency: asCurrency(data.currency) } : {}),
      ...("exchangeMode" in data ? { exchangeMode: asExchangeMode(data.exchangeMode) } : {}),
      ...("exchangeSource" in data ? { exchangeSource: asExchangeSource(data.exchangeSource) } : {}),
      ...("manualBuy" in data ? { manualBuy: positiveRate(data.manualBuy) } : {}),
      ...("manualSell" in data ? { manualSell: positiveRate(data.manualSell) } : {}),
      ...contact,
      ...("phone" in data ? { phone: blankToNull(data.phone) } : {}),
      ...("legalName" in data ? { legalName: blankToNull(data.legalName) } : {}),
      ...("taxId" in data ? { taxId: blankToNull(data.taxId) } : {}),
      ...("address" in data ? { address: blankToNull(data.address) } : {}),
      ...("usedWarrantyDays" in data ? { usedWarrantyDays: data.usedWarrantyDays } : {}),
      ...("sealedWarrantyDays" in data ? { sealedWarrantyDays: data.sealedWarrantyDays } : {}),
      ...("repairWarrantyDays" in data ? { repairWarrantyDays: data.repairWarrantyDays } : {}),
    },
  });
}

async function assertManualQuoteUpdate(storeId: string, data: StoreUpdateInput) {
  const touchesQuote = "exchangeMode" in data || "manualBuy" in data || "manualSell" in data;
  if (!touchesQuote) return;

  const current = await prisma.store.findUnique({
    where: { id: storeId },
    select: { exchangeMode: true, manualBuy: true, manualSell: true },
  });
  if (!current) throw new DomainError("Tienda no encontrada", 404);

  const mode = "exchangeMode" in data ? asExchangeMode(data.exchangeMode) : asExchangeMode(current.exchangeMode);
  if (mode !== "manual") return;

  const buy = "manualBuy" in data ? positiveRate(data.manualBuy) : positiveRate(current.manualBuy);
  const sell = "manualSell" in data ? positiveRate(data.manualSell) : positiveRate(current.manualSell);
  assertManualQuoteOrder(buy, sell);
}

export async function listMembers(storeId: string) {
  const members = await prisma.storeMember.findMany({
    where: { storeId },
    include: {
      user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map(serializeMember);
}

function serializeMember(member: {
  id: string;
  userId: string;
  role: StoreRole;
  isDefault: boolean;
  createdAt: Date;
  sections?: unknown;
  sensitiveAccess?: boolean | null;
  user: { id: string; displayName: string | null; email: string | null; avatarUrl: string | null };
}) {
  return {
    id: member.id,
    userId: member.userId,
    role: member.role,
    isDefault: member.isDefault,
    createdAt: member.createdAt,
    sections: member.role === "OWNER" ? null : normalizeSections(member.sections),
    sensitiveAccess: member.role === "OWNER" ? null : member.sensitiveAccess ?? null,
    user: member.user,
  };
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  newRole: StoreRole,
  actorRole: StoreRole,
  actorUserId: string
) {
  if (actorRole !== "OWNER" && actorRole !== "MANAGER") {
    throw new DomainError("No tenés permisos para gestionar el equipo", 403);
  }

  const target = await prisma.storeMember.findFirst({ where: { id: memberId, storeId } });
  if (!target) {
    throw new DomainError("Miembro no encontrado", 404);
  }

  if (actorRole === "MANAGER" && (target.role !== "STAFF" || target.userId === actorUserId || newRole !== "STAFF")) {
    throw new DomainError("Solo el Propietario puede cambiar ese rol", 403);
  }

  // Cannot leave store without an OWNER
  if (target.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await prisma.storeMember.count({ where: { storeId, role: "OWNER" } });
    if (ownerCount <= 1) {
      throw new DomainError("No puede haber una tienda sin Propietario", 400);
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
    throw new DomainError("No tenés permisos para gestionar el equipo", 403);
  }

  const target = await prisma.storeMember.findFirst({
    where: { id: memberId, storeId },
    include: { user: true },
  });
  if (!target) {
    throw new DomainError("Miembro no encontrado", 404);
  }

  if (actorRole === "MANAGER" && (target.role !== "STAFF" || target.userId === actorUserId)) {
    throw new DomainError("Solo podés quitar Empleados del equipo", 403);
  }

  // Cannot remove the only OWNER
  if (target.role === "OWNER") {
    const ownerCount = await prisma.storeMember.count({ where: { storeId, role: "OWNER" } });
    if (ownerCount <= 1) {
      throw new DomainError("No puede haber una tienda sin Propietario", 400);
    }
  }

  await prisma.storeMember.delete({ where: { id: memberId } });
}

export async function updateMemberSections(
  storeId: string,
  memberId: string,
  sections: string[],
  actorRole: StoreRole,
  actorUserId: string,
  sensitiveAccess?: boolean | null,
) {
  if (actorRole !== "OWNER" && actorRole !== "MANAGER") {
    throw new DomainError("No tenés permisos para gestionar el equipo", 403);
  }

  const target = await prisma.storeMember.findFirst({
    where: { id: memberId, storeId },
    include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
  });
  if (!target) {
    throw new DomainError("Miembro no encontrado", 404);
  }
  if (target.role === "OWNER") {
    throw new DomainError("El propietario conserva el acceso a todas las secciones", 403);
  }

  if (actorRole === "MANAGER" && (target.role !== "STAFF" || target.userId === actorUserId)) {
    throw new DomainError("Solo podés editar los permisos de Empleados", 403);
  }

  const next = assertSectionList(sections);
  const updated = await prisma.storeMember.update({
    where: { id: memberId },
    data: {
      sections: next,
      ...(sensitiveAccess !== undefined ? { sensitiveAccess } : {}),
    },
    include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
  });
  return serializeMember(updated);
}

export async function getStoreOwnerName(storeId: string) {
  const owner = await prisma.storeMember.findFirst({ where: { storeId, role: 'OWNER' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { displayName: true } } } });
  return owner?.user.displayName || 'el propietario';
}
