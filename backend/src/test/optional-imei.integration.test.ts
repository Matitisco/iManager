import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

function headersFor(context: Awaited<ReturnType<typeof seedStoreContext>>) {
  return {
    "content-type": "application/json",
    ...buildAuthHeaders({
      uid: context.user.firebaseUid,
      email: context.user.email ?? undefined,
      name: context.user.displayName ?? undefined,
    }),
  };
}

function equipment(imei: string) {
  return {
    imei,
    model: "iPhone 13",
    capacity: "128GB",
    color: "Negro",
    condition: "USADO",
    grade: "A",
    batteryHealth: "90%",
    cost: 100,
    price: 200,
    status: "DISPONIBLE",
  };
}

describe("optional IMEI", () => {
  it("stores several empty inventory IMEIs as null without a unique collision", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const first = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment("") });
    const second = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: { ...equipment("   "), model: "Pixel 8" } });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().inventoryItem.imei).toBe("");
    expect(second.json().inventoryItem.imei).toBe("");

    const stored = await prisma.inventoryItem.findMany({
      where: { storeId: context.store!.id },
      orderBy: { model: "asc" },
    });
    expect(stored).toHaveLength(2);
    expect(stored.every((item) => item.imei === null)).toBe(true);
  });

  it("rejects a non-empty inventory IMEI that is not 15 digits and keeps a valid one unique", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const invalid = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment("12345") });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().message).toBe("El IMEI tiene 15 dígitos");

    const created = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment("350000000000095") });
    expect(created.statusCode).toBe(201);

    const duplicate = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment("350000000000095") });
    expect(duplicate.statusCode).toBe(409);
  });

  it("imports inventory rows without an IMEI and reports a bad format per row", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const imported = await app.inject({
      method: "POST",
      url: "/api/inventory/import",
      headers,
      payload: {
        rows: [
          { imei: "", model: "Sin IMEI A", price: 100 },
          { imei: "   ", model: "Sin IMEI B", price: 120 },
          { imei: "123", model: "Mal formato", price: 80 },
          { imei: "350000000000096", model: "Con IMEI", price: 200 },
        ],
      },
    });

    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({
      imported: 3,
      errors: [{ row: 3, message: "El IMEI tiene 15 dígitos" }],
    });
    const stored = await prisma.inventoryItem.findMany({ where: { storeId: context.store!.id } });
    expect(stored.filter((item) => item.imei === null)).toHaveLength(2);
    expect(stored.some((item) => item.imei === "350000000000096")).toBe(true);
  });

  it("accepts an empty received IMEI on a trade-in and a repair, and an empty product IMEI on a sale import", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const trade = await app.inject({
      method: "POST",
      url: "/api/trade-ins",
      headers,
      payload: {
        clientName: "Ana",
        deviceReceived: "iPhone 11",
        deviceReceivedImei: "",
        takeValue: 100,
        deviceGiven: "Equipo libre",
        differencePaid: 50,
        draft: true,
      },
    });
    expect(trade.statusCode).toBe(201);
    expect(trade.json().tradeIn.deviceReceivedImei).toBe("");

    const badTrade = await app.inject({
      method: "POST",
      url: "/api/trade-ins",
      headers,
      payload: {
        clientName: "Ana",
        deviceReceived: "iPhone 11",
        deviceReceivedImei: "999",
        takeValue: 100,
        deviceGiven: "Equipo libre",
      },
    });
    expect(badTrade.statusCode).toBe(400);
    expect(badTrade.json().message).toBe("El IMEI tiene 15 dígitos");

    const repair = await app.inject({
      method: "POST",
      url: "/api/repairs",
      headers,
      payload: { clientName: "Ana", device: "iPhone 12", imei: "", faultTags: ["Pantalla"] },
    });
    expect(repair.statusCode).toBe(201);
    expect(repair.json().order.imei).toBe("");

    const sale = await app.inject({
      method: "POST",
      url: "/api/sales/import",
      headers,
      payload: { rows: [{ clientName: "Ana", productImei: "", amount: "1500" }] },
    });
    expect(sale.statusCode).toBe(200);
    expect(sale.json()).toMatchObject({ imported: 1, errors: [] });
    const storedSale = await prisma.sale.findFirstOrThrow({ where: { storeId: context.store!.id } });
    expect(storedSale.inventoryItemId).toBeNull();
  });
});
