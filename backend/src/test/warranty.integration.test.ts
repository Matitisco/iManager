import { describe, expect, it } from "vitest";
import { formatArDate, parseArDate } from "../lib/ar-date.js";
import { coverageState, warrantyUntil } from "../modules/warranty/warranty.js";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

describe("warranties", () => {
  const ctx = useIntegrationApp();

  it("stores sale and repair days, and moves the sale end date when the sale date changes", async () => {
    const app = ctx.getApp();
    const owner = await seedStoreContext();
    const fixture = await seedCatalogFixture(owner.store!.id);
    const headers = { ...buildAuthHeaders({ uid: owner.user.firebaseUid, email: owner.user.email ?? undefined }) };
    const sealed = await prisma.inventoryItem.create({
      data: {
        storeId: owner.store!.id,
        imei: "359000000000001",
        model: "iPhone 16",
        capacity: "128GB",
        color: "Negro",
        condition: "NUEVO",
        grade: "",
        batteryHealth: "100%",
        cost: 1,
        price: 2,
        status: "DISPONIBLE",
      },
    });

    const settings = await app.inject({
      method: "PATCH",
      url: "/api/stores/current",
      headers,
      payload: { usedWarrantyDays: 10, sealedWarrantyDays: 40, repairWarrantyDays: 7 },
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().store).toMatchObject({ usedWarrantyDays: 10, sealedWarrantyDays: 40, repairWarrantyDays: 7 });

    const sold = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        productId: sealed.id,
        amount: 2,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        date: "01/10/2026",
      },
    });
    expect(sold.statusCode).toBe(201);
    expect(sold.json().sale.warrantyDays).toBe(40);
    expect(formatArDate(warrantyUntil(parseArDate("01/10/2026"), 40)!)).toBe("10/11/2026");

    const moved = await app.inject({
      method: "PATCH",
      url: `/api/operations/sales/sales/${sold.json().sale.id}`,
      headers,
      payload: { date: "05/10/2026" },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().sale).toMatchObject({ date: "05/10/2026", warrantyDays: 40 });
    expect(formatArDate(warrantyUntil(parseArDate(moved.json().sale.date), moved.json().sale.warrantyDays)!)).toBe("14/11/2026");

    const used = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientId: fixture.client.id,
        productId: fixture.inventoryItem.id,
        amount: 1200,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        date: "01/10/2026",
        warrantyDays: 0,
      },
    });
    expect(used.statusCode).toBe(201);
    expect(used.json().sale.warrantyDays).toBe(0);

    const repair = await app.inject({
      method: "POST",
      url: "/api/repairs",
      headers,
      payload: { clientId: fixture.client.id, device: "iPhone 14", imei: "350000000000095", fault: "Batería" },
    });
    expect(repair.statusCode).toBe(201);
    expect(repair.json().order).toMatchObject({ warrantyDays: 7, warrantyState: "pendiente", warrantyUntil: null });

    const delivered = await app.inject({
      method: "POST",
      url: `/api/repairs/${repair.json().order.id}/status`,
      headers,
      payload: { status: "ENTREGADO" },
    });
    expect(delivered.statusCode).toBe(200);
    const order = delivered.json().order as { id: string; warrantyDays: number; warrantyUntil: string; warrantyState: string; events: Array<{ createdAt: string }> };
    const deliveredAt = order.events[order.events.length - 1]?.createdAt;
    const until = warrantyUntil(parseArDate(deliveredAt), order.warrantyDays);
    expect(order.warrantyUntil).toBe(formatArDate(until!));
    expect(order.warrantyState).toBe(coverageState(until));

    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/repairs/${order.id}`,
      headers,
      payload: { warrantyDays: 0 },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().order).toMatchObject({ warrantyDays: 0, warrantyState: "sin", warrantyUntil: null });
  });
});
