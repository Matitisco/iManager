import { track, trackMany, markFirstSteps } from '../analytics/track.js';
import { randomUUID } from "node:crypto";
import { prisma } from "../../plugins/prisma.js";
import { lockTransactionKey } from "../../lib/advisory-lock.js";
import { DomainError } from "../../lib/domain-error.js";
import { canAccessSection } from "../stores/sections.js";
import { evaluateFirstSteps, firstStepsVisibleTo } from "./first-steps.js";

type Member = {
  storeId: string;
  userId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  sections?: string[] | null;
};
export type GettingStartedPatch = {
  dismissed?: boolean;
  visible?: boolean;
  installed?: true;
  complete?: true;
  completedVia?: "import" | "skip" | "sample";
  installedHow?: "prompt" | "manual";
  stage?: "invite" | "stock";
};

export async function getGettingStarted(member: Member) {
  const { storeId, userId, role, sections } = member;
  const can = (section: "inventory" | "sales" | "publicCatalog") =>
    canAccessSection(section, { sections, role });
  const [store, preferences, stock, sales, members, invitations, catalog, samples] =
    await Promise.all([
      prisma.store.findUniqueOrThrow({
        where: { id: storeId },
        select: {
          name: true,
          createdAt: true,
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
      can("sales") ? prisma.sale.count({ where: { storeId, voidedAt: null } }) : 0,
      firstStepsVisibleTo(role)
        ? prisma.storeMember.count({ where: { storeId, removedAt: null } })
        : 0,
      firstStepsVisibleTo(role)
        ? prisma.storeInvitation.count({ where: { storeId } })
        : 0,
      can("publicCatalog")
        ? prisma.storePublicCatalog.findUnique({ where: { storeId } })
        : null,
      can("inventory")
        ? prisma.inventoryItem.count({
            where: { storeId, archivedAt: null, sampleBatchId: { not: null } },
          })
        : 0,
    ]);
  const steps = firstStepsVisibleTo(role)
    ? evaluateFirstSteps({
        storeName: store.name,
        inventoryItems: stock,
        sales,
        members,
        invitations,
        installed: preferences.appInstalled,
      })
    : { store: false, stock: false, sale: false, team: false, install: false };
  if (firstStepsVisibleTo(role)) void markFirstSteps(storeId, userId, steps, store.createdAt);
  return {
    stage: "stock",
    eligible: store.onboardingStartedAt !== null,
    active:
      store.onboardingStartedAt !== null &&
      store.onboardingCompletedAt === null &&
      role === "OWNER",
    dismissed: preferences.gettingStartedDismissed,
    stock,
    sales: steps.sale,
    team: steps.team,
    catalog: Boolean(catalog?.active),
    installed: preferences.appInstalled,
    visible: preferences.gettingStartedVisible,
    samples,
    storeNamed: steps.store,
    steps,
  };
}

export async function patchGettingStarted(
  member: Member,
  patch: GettingStartedPatch,
) {
  const completed = await prisma.$transaction(async (tx) => {
    let completed = false;
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
      const result = await tx.store.updateMany({ where: { id: member.storeId, onboardingStartedAt: { not: null }, onboardingCompletedAt: null }, data: { onboardingCompletedAt: new Date() } });
      completed = result.count === 1;
    }
    await tx.storeMember.update({
      where: {
        storeId_userId: { storeId: member.storeId, userId: member.userId },
      },
      data: {
        ...(patch.dismissed !== undefined
          ? { gettingStartedDismissed: patch.dismissed }
          : {}),
        ...(patch.visible !== undefined
          ? { gettingStartedVisible: patch.visible }
          : {}),
        ...(patch.installed ? { appInstalled: true } : {}),
      },
    });
    return completed;
  });
  if (completed) void track({ name: 'onboarding_completed', storeId: member.storeId, userId: member.userId, props: patch.completedVia ? { via: patch.completedVia } : {}, dedupeKey: `onb_done:${member.storeId}` });
  if (patch.installed) void track({ name: 'app_installed', storeId: member.storeId, userId: member.userId, props: patch.installedHow ? { how: patch.installedHow } : {}, dedupeKey: `installed:${member.storeId}:${member.userId}` });
  return getGettingStarted(member);
}

export async function createSampleStock(storeId: string) {
  const loaded = await prisma.$transaction(async (tx) => {
    await lockTransactionKey(tx, `onboarding-samples:${storeId}`);
    const store = await tx.store.findUniqueOrThrow({ where: { id: storeId } });
    if (!store.onboardingStartedAt)
      throw new DomainError(
        "Los ejemplos solo están disponibles para una tienda configurada en iManager.",
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
    await tx.store.update({ where: { id: storeId }, data: { onboardingCompletedAt: new Date() } });
    return { completed: store.onboardingCompletedAt === null };
  });
  if (loaded) void trackMany([
    { name: 'sample_stock_loaded', storeId },
    ...(loaded.completed ? [{ name: 'onboarding_completed' as const, storeId, props: { via: 'sample' }, dedupeKey: `onb_done:${storeId}` }] : []),
  ]);
}

export async function deleteSampleStock(storeId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await lockTransactionKey(tx, `onboarding-samples:${storeId}`);
    return tx.inventoryItem.deleteMany({
      where: { storeId, sampleBatchId: { not: null } },
    });
  });
  if (result.count > 0) void track({ name: 'sample_stock_deleted', storeId });
  return result;
}
