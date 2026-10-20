import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();
const VALID = "352098117744522";
const SECOND = "353911220588306";
const BAD_LUHN = "352098117744521";

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

function equipment(imei: string, overrides: Record<string, unknown> = {}) {
  return {
    imei,
    model: "iPhone 13",
    capacity: "128GB",
    color: "Medianoche",
    condition: "USADO",
    grade: "A",
    batteryHealth: "86%",
    cost: 100,
    price: 850000,
    status: "DISPONIBLE",
    ...overrides,
  };
}

describe("inventory batch scan", () => {
  it("creates valid rows, rejects Luhn and duplicates, and restocks a sold IMEI", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: "other-scan-owner", email: "other-scan@example.com" });
    if (!context.store || !other.store) throw new Error("missing store");
    const headers = headersFor(context);

    const sold = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: equipment(VALID, { status: "VENDIDO", model: "iPhone 13 vendido" }),
    });
    expect(sold.statusCode).toBe(201);
    const soldId = sold.json().inventoryItem.id as string;

    const active = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: equipment(SECOND, { model: "iPhone 14" }),
    });
    expect(active.statusCode).toBe(201);

    const batch = await app.inject({
      method: "POST",
      url: "/api/inventory/batch",
      headers,
      payload: {
        items: [
          equipment(VALID, { model: "iPhone 13 nuevo" }),
          equipment(VALID),
          equipment(BAD_LUHN),
          equipment(SECOND),
          equipment("356771042207122"),
        ],
      },
    });
    expect(batch.statusCode).toBe(201);
    const body = batch.json();
    expect(body.created.map((item: { imei: string }) => item.imei).sort()).toEqual(["352098117744522", "356771042207122"]);
    expect(body.errors.map((item: { message: string }) => item.message)).toEqual([
      "Repetido en esta carga",
      "El IMEI no pasa el control de dígito",
      "Ya está en tu stock",
    ]);

    const retired = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: soldId } });
    expect(retired.imei).toBeNull();
    expect(retired.customFields).toMatchObject({ keptImei: VALID });

    const created = body.created.find((item: { imei: string }) => item.imei === VALID);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: created.id, action: "inventory.created" } })).toMatchObject({
      storeId: context.store!.id,
      source: "bulk",
    });
    expect(await prisma.auditEvent.findFirst({ where: { entityId: soldId, action: "inventory.updated" } })).toMatchObject({
      detail: "El IMEI volvió a entrar en stock",
    });

    const isolated = await app.inject({
      method: "POST",
      url: "/api/inventory/batch",
      headers: headersFor(other),
      payload: { items: [equipment("358802114509174")] },
    });
    expect(isolated.statusCode).toBe(201);
    expect(isolated.json().created).toHaveLength(1);
    expect(await prisma.inventoryItem.count({ where: { storeId: other.store!.id, imei: "358802114509174" } })).toBe(1);
    expect(await prisma.inventoryItem.count({ where: { storeId: context.store!.id, imei: "358802114509174" } })).toBe(0);
  });
});
