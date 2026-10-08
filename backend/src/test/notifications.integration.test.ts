import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("persistent notifications API", () => {
  it("filters by store section and keeps read state per user across requests", async () => {
    const app = getApp();
    const owner = await seedStoreContext();
    const [salesNote, inventoryNote] = await Promise.all([
      prisma.storeNotification.create({ data: { storeId: owner.store!.id, section: "sales", title: "Venta", message: "Venta registrada", recordId: "sale-1", kind: "INTEGRATED_OPERATION" } }),
      prisma.storeNotification.create({ data: { storeId: owner.store!.id, section: "inventory", title: "Stock", message: "Equipo vendido", recordId: "item-1", kind: "INTEGRATED_OPERATION" } }),
    ]);
    const staff = await prisma.user.create({ data: { firebaseUid: "notifications-sales-staff", email: "sales-staff@example.com", displayName: "Sales Staff" } });
    await prisma.storeMember.create({ data: { storeId: owner.store!.id, userId: staff.id, role: "STAFF", sections: ["notifications", "sales"], isDefault: true } });
    const salesOnly = await prisma.user.create({ data: { firebaseUid: "notifications-no-feed", email: "no-feed@example.com", displayName: "No Feed" } });
    await prisma.storeMember.create({ data: { storeId: owner.store!.id, userId: salesOnly.id, role: "STAFF", sections: ["sales"], isDefault: true } });
    const ownerHeaders = { ...buildAuthHeaders({ uid: owner.user.firebaseUid ?? "test-owner", email: owner.user.email ?? undefined }), "content-type": "application/json" };
    const staffHeaders = { ...buildAuthHeaders({ uid: staff.firebaseUid ?? "notifications-sales-staff", email: staff.email ?? undefined }), "content-type": "application/json" };
    const noFeedHeaders = { ...buildAuthHeaders({ uid: salesOnly.firebaseUid ?? "notifications-no-feed", email: salesOnly.email ?? undefined }), "content-type": "application/json" };

    const ownerList = await app.inject({ method: "GET", url: "/api/notifications", headers: ownerHeaders });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json().notifications).toHaveLength(2);
    const ownerRead = await app.inject({ method: "POST", url: `/api/notifications/${salesNote.id}/read`, headers: ownerHeaders, payload: {} });
    expect(ownerRead.statusCode).toBe(200);
    const staffList = await app.inject({ method: "GET", url: "/api/notifications", headers: staffHeaders });
    expect(staffList.statusCode).toBe(200);
    expect(staffList.json().notifications).toHaveLength(1);
    expect(staffList.json().notifications[0]).toMatchObject({ id: salesNote.id, readAt: null });
    expect((await app.inject({ method: "POST", url: `/api/notifications/${inventoryNote.id}/read`, headers: staffHeaders, payload: {} })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/notifications", headers: noFeedHeaders })).statusCode).toBe(403);

    const readAll = await app.inject({ method: "POST", url: "/api/notifications/read-all", headers: staffHeaders, payload: {} });
    expect(readAll.statusCode).toBe(200);
    expect(readAll.json()).toEqual({ count: 1 });
    const staffAfter = await app.inject({ method: "GET", url: "/api/notifications", headers: staffHeaders });
    expect(staffAfter.json().notifications[0]?.readAt).toBeTruthy();
    const ownerAfter = await app.inject({ method: "GET", url: "/api/notifications", headers: ownerHeaders });
    expect(ownerAfter.json().notifications.find((item: { id: string }) => item.id === salesNote.id)?.readAt).toBeTruthy();
    expect(ownerAfter.json().notifications.find((item: { id: string }) => item.id === inventoryNote.id)?.readAt).toBeNull();
  });
});
