import { randomUUID } from "node:crypto";
import { prisma } from "../../plugins/prisma.js";
import { lockTransactionKey } from "../../lib/advisory-lock.js";
import { DomainError } from "../../lib/domain-error.js";
import { canAccessSection } from "../stores/sections.js";

type Member = {
  storeId: string;
  userId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  sections?: string[] | null;
};
export type GettingStartedPatch = {
  dismissed?: boolean;
  videoWatched?: true;
  installed?: true;
  complete?: true;
  stage?: "invite" | "stock";
};

export async function getGettingStarted(member: Member) {
  const { storeId, userId, role, sections } = member;
  const can = (section: "inventory" | "sales") =>
    canAccessSection(section, { sections, role });
  const [store, preferences, stock, sales, employees, catalog, samples] =
    await Promise.all([
      prisma.store.findUniqueOrThrow({
        where: { id: storeId },
        select: {
          onboardingStartedAt: true,
          onboardingCompletedAt: true,
          onboardingStage: true,
        },
      }),
      prisma.storeMember.findUniqueOrThrow({
        where: { storeId_userId: { storeId, userId } },
      }),
      can("inventory")
        ? prisma.inventoryItem.count({
            where: { storeId, archivedAt: null, sampleBatchId: null },
          })
        : 0,
      can("sales")
        ? prisma.sale.count({
            where: { storeId, status: { not: "CANCELADA" } },
          })
        : 0,
      role !== "STAFF"
        ? prisma.storeMember.count({
            where: { storeId, role: { not: "OWNER" } },
          })
        : 0,
      role === "OWNER"
        ? prisma.storePublicCatalog.findUnique({ where: { storeId } })
        : null,
      can("inventory")
        ? prisma.inventoryItem.count({
            where: { storeId, sampleBatchId: { not: null } },
          })
        : 0,
    ]);
  return {
    stage: store.onboardingStage ?? "stock",
    eligible: store.onboardingStartedAt !== null,
    active:
      store.onboardingStartedAt !== null &&
      store.onboardingCompletedAt === null &&
      role === "OWNER",
    dismissed: preferences.gettingStartedDismissed,
    stock,
    sales: sales > 0,
    team: employees > 0,
    catalog: Boolean(catalog?.active),
    installed: preferences.appInstalled,
    videoWatched: preferences.welcomeVideoWatched,
    samples,
  };
}

export async function patchGettingStarted(
  member: Member,
  patch: GettingStartedPatch,
) {
  await prisma.$transaction(async (tx) => {
    if (patch.stage) {
      if (member.role !== "OWNER")
        throw new DomainError(
          "Solo el dueño puede avanzar la configuración inicial.",
          403,
        );
      await tx.store.updateMany({
        where: {
          id: member.storeId,
          onboardingStartedAt: { not: null },
          onboardingCompletedAt: null,
        },
        data: { onboardingStage: patch.stage },
      });
    }
    if (patch.complete) {
      if (member.role !== "OWNER")
        throw new DomainError(
          "Solo el dueño puede completar la configuración inicial.",
          403,
        );
      await tx.store.updateMany({
        where: {
          id: member.storeId,
          onboardingStartedAt: { not: null },
          onboardingCompletedAt: null,
        },
        data: { onboardingCompletedAt: new Date() },
      });
    }
    await tx.storeMember.update({
      where: {
        storeId_userId: { storeId: member.storeId, userId: member.userId },
      },
      data: {
        ...(patch.dismissed !== undefined
          ? { gettingStartedDismissed: patch.dismissed }
          : {}),
        ...(patch.videoWatched ? { welcomeVideoWatched: true } : {}),
        ...(patch.installed ? { appInstalled: true } : {}),
      },
    });
  });
  return getGettingStarted(member);
}

export async function createSampleStock(storeId: string) {
  return prisma.$transaction(async (tx) => {
    await lockTransactionKey(tx, `onboarding-samples:${storeId}`);
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    if (!store.onboardingStartedAt || store.onboardingCompletedAt)
      throw new DomainError(
        "Los ejemplos solo están disponibles durante la configuración inicial.",
        409,
      );
    if (
      await tx.inventoryItem.count({
        where: { storeId, sampleBatchId: { not: null } },
      })
    )
      return;
    const sampleBatchId = randomUUID();
    await tx.inventoryItem.createMany({
      data: [
        {
          model: "iPhone 13 Pro Max",
          capacity: "256GB",
          color: "Azul",
          price: 520,
          cost: 430,
        },
        {
          model: "iPhone 14",
          capacity: "128GB",
          color: "Midnight",
          price: 590,
          cost: 480,
        },
        {
          model: "iPhone 15 Pro",
          capacity: "256GB",
          color: "Natural",
          price: 980,
          cost: 810,
        },
      ].map((row) => ({
        ...row,
        storeId,
        sampleBatchId,
        currency: "USD",
        condition: "USADO",
        grade: "A",
        batteryHealth: "90%",
        status: "DISPONIBLE",
      })),
    });
    await tx.store.update({
      where: { id: storeId },
      data: { onboardingCompletedAt: new Date() },
    });
  });
}

export async function deleteSampleStock(storeId: string) {
  return prisma.$transaction(async (tx) => {
    await lockTransactionKey(tx, `onboarding-samples:${storeId}`);
    return tx.inventoryItem.deleteMany({
      where: { storeId, sampleBatchId: { not: null } },
    });
  });
}
