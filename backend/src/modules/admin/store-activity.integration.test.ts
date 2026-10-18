import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../plugins/prisma.js";
import { useIntegrationApp } from "../../test/integration-helpers.js";
import { buildAuthHeaders } from "../../test/db.js";
import type { StoreActivityResponse } from "./store-activity.service.js";

const { getApp } = useIntegrationApp();
const previousAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previousAdminEmails;
});

const adminHeaders = () => buildAuthHeaders({ uid: "platform-admin", email: "admin@internal.test", name: "Admin" });

async function seedActivity() {
  const now = Date.now();
  const blank = await prisma.user.create({ data: { firebaseUid: "blank-owner", email: null, displayName: "Sin mail" } });
  const owner = await prisma.user.create({ data: { firebaseUid: "real-owner", email: "Matias.Owner@Tienda.com", displayName: "Dueño" } });
  const staff = await prisma.user.create({ data: { firebaseUid: "staff-member", email: "staff.person@tienda.com", displayName: "Empleado" } });
  const demoOwner = await prisma.user.create({ data: { firebaseUid: "demo-owner", email: "qa.owner@example.com", displayName: "Demo" } });
  const legacyOwner = await prisma.user.create({ data: { firebaseUid: "legacy-owner", email: "club.owner@tienda.com", displayName: "Club" } });

  const recent = await prisma.store.create({
    data: {
      name: "iphoneclub",
      billingPlan: "TRIAL",
      billingStatus: "TRIAL",
      trialEndsAt: new Date("2026-10-24T03:00:00.000Z"),
      onboardingStage: "invite",
      createdAt: new Date(now - 86_400_000),
    },
  });
  await prisma.storeMember.create({ data: { storeId: recent.id, userId: blank.id, role: "OWNER", createdAt: new Date("2026-01-01T00:00:00.000Z") } });
  await prisma.storeMember.create({ data: { storeId: recent.id, userId: owner.id, role: "OWNER", createdAt: new Date("2026-01-02T00:00:00.000Z") } });
  await prisma.storeMember.create({ data: { storeId: recent.id, userId: staff.id, role: "STAFF", createdAt: new Date("2026-01-03T00:00:00.000Z") } });
  await prisma.inventoryItem.create({
    data: {
      storeId: recent.id, model: "iPhone 13", capacity: "128GB", color: "Negro", condition: "USADO", grade: "A",
      batteryHealth: "90%", cost: 100, price: 200, status: "DISPONIBLE", createdAt: new Date("2026-08-01T12:00:00.000Z"),
    },
  });
  await prisma.inventoryItem.create({
    data: {
      storeId: recent.id, model: "iPhone 14", capacity: "256GB", color: "Azul", condition: "USADO", grade: "B",
      batteryHealth: "88%", cost: 150, price: 280, status: "DISPONIBLE", createdAt: new Date("2026-08-15T12:00:00.000Z"),
    },
  });
  await prisma.sale.create({
    data: {
      storeId: recent.id, amount: 280, paymentMethod: "EFECTIVO", status: "COMPLETADA", dateLabel: "01/09/2026",
      soldAt: new Date("2026-09-01T12:00:00.000Z"), createdAt: new Date("2026-09-01T12:00:00.000Z"),
    },
  });
  await prisma.client.create({ data: { storeId: recent.id, name: "Ana", createdAt: new Date("2026-07-01T12:00:00.000Z") } });
  await prisma.client.create({ data: { storeId: recent.id, name: "Luis", createdAt: new Date("2026-07-02T12:00:00.000Z") } });
  await prisma.repairOrder.create({
    data: { storeId: recent.id, device: "iPhone 11", createdAt: new Date("2026-12-01T12:00:00.000Z") },
  });
  await prisma.auditEvent.create({
    data: {
      storeId: recent.id, actorName: "Dueño", action: "inventory.updated", entityType: "InventoryItem", entityId: "item",
      createdAt: new Date("2026-10-01T15:04:00.000Z"),
    },
  });

  const demo = await prisma.store.create({
    data: { name: "demo caja", createdAt: new Date(now - 2 * 86_400_000) },
  });
  await prisma.storeMember.create({ data: { storeId: demo.id, userId: demoOwner.id, role: "OWNER" } });

  const legacy = await prisma.store.create({
    data: {
      name: "1St",
      billingPlan: "INTERNAL",
      billingStatus: "ACTIVE",
      createdAt: new Date(now - 45 * 86_400_000),
    },
  });
  await prisma.storeMember.create({ data: { storeId: legacy.id, userId: legacyOwner.id, role: "OWNER" } });

  return { recent, demo, legacy };
}

describe("GET /admin/store-activity", () => {
  it("answers 403 for a signed-in user who is not on the allowlist", async () => {
    process.env.ADMIN_EMAILS = "admin@internal.test";
    await seedActivity();
    const response = await getApp().inject({
      method: "GET",
      url: "/admin/store-activity",
      headers: buildAuthHeaders({ uid: "real-owner", email: "Matias.Owner@Tienda.com", name: "Dueño" }),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Forbidden" });
    expect(response.body).not.toContain("iphoneclub");
    expect(response.body).not.toContain("Matias.Owner");
    expect(response.body).not.toContain("staff.person");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns masked store activity for an allowlisted email and keeps older stores out of the default window", async () => {
    process.env.ADMIN_EMAILS = " Admin@Internal.Test ";
    const { recent, legacy } = await seedActivity();
    const beforeAudits = await prisma.auditEvent.count();
    const response = await getApp().inject({ method: "GET", url: "/admin/store-activity", headers: adminHeaders() });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json() as StoreActivityResponse;
    expect(body.range).toBe("30d");
    expect(body.stores.map((store) => store.name).sort()).toEqual(["demo caja", "iphoneclub"]);
    expect(body.stores.some((store) => store.id === legacy.id)).toBe(false);

    const club = body.stores.find((store) => store.id === recent.id);
    expect(club).toMatchObject({
      name: "iphoneclub",
      ownerEmail: "Ma***@tienda.com",
      billingPlan: "TRIAL",
      billingStatus: "TRIAL",
      trialEndsAt: "2026-10-24T03:00:00.000Z",
      onboardingStage: "invite",
      counts: { storeMembers: 3, inventoryItems: 2, sales: 1, clients: 2, repairOrders: 1 },
      lastActivityAt: "2026-10-01T15:04:00.000Z",
    });
    expect(club?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const demo = body.stores.find((store) => store.name === "demo caja");
    expect(demo?.ownerEmail).toBe("qa***@example.com");
    expect(demo?.billingPlan).toBe("INTERNAL");

    expect(response.body).not.toContain("Matias.Owner");
    expect(response.body).not.toContain("staff.person");
    expect(response.body).not.toContain("qa.owner");
    expect(response.body).not.toContain("club.owner");
    expect(await prisma.auditEvent.count()).toBe(beforeAudits);
  });

  it("returns every store when range=all", async () => {
    process.env.ADMIN_EMAILS = "admin@internal.test,second@internal.test";
    const { legacy } = await seedActivity();
    const response = await getApp().inject({
      method: "GET",
      url: "/admin/store-activity?range=all",
      headers: buildAuthHeaders({ uid: "second-admin", email: "SECOND@internal.test", name: "Segundo" }),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as StoreActivityResponse;
    expect(body.range).toBe("all");
    const old = body.stores.find((store) => store.id === legacy.id);
    expect(old).toMatchObject({
      name: "1St",
      ownerEmail: "cl***@tienda.com",
      billingPlan: "INTERNAL",
      billingStatus: "ACTIVE",
      trialEndsAt: null,
      onboardingStage: null,
      counts: { storeMembers: 1, inventoryItems: 0, sales: 0, clients: 0, repairOrders: 0 },
      lastActivityAt: null,
    });
    expect(response.body).not.toContain("club.owner");
  });

  it("requires a session and rejects an unknown range", async () => {
    process.env.ADMIN_EMAILS = "admin@internal.test";
    const missing = await getApp().inject({ method: "GET", url: "/admin/store-activity" });
    expect(missing.statusCode).toBe(401);

    const bad = await getApp().inject({ method: "GET", url: "/admin/store-activity?range=forever", headers: adminHeaders() });
    expect(bad.statusCode).toBe(400);
  });
});
