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

function equipment(overrides: Record<string, unknown> = {}) {
  return {
    imei: "",
    model: "iPhone 13",
    capacity: "128GB",
    color: "Azul",
    condition: "USADO",
    grade: "A",
    batteryHealth: "90%",
    cost: 100,
    price: 200,
    status: "DISPONIBLE",
    ...overrides,
  };
}

describe("inventory color", () => {
  it("stores an optional color on create and update", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const created = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: equipment({ color: "  Verde  " }),
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().inventoryItem.color).toBe("Verde");

    const blank = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: equipment({ model: "Sin color", color: "" }),
    });
    expect(blank.statusCode).toBe(201);
    expect(blank.json().inventoryItem.color).toBe("");

    const tooLong = await app.inject({
      method: "POST",
      url: "/api/inventory",
      headers,
      payload: equipment({ model: "Largo", color: "a".repeat(51) }),
    });
    expect(tooLong.statusCode).toBe(400);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${created.json().inventoryItem.id}`,
      headers,
      payload: { color: "Negro" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().inventoryItem.color).toBe("Negro");
  });

  it("imports the color column and rejects a value longer than 50 characters", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const imported = await app.inject({
      method: "POST",
      url: "/api/inventory/import",
      headers,
      payload: {
        rows: [
          { imei: "", model: "Con color", price: 100, color: " Medianoche " },
          { imei: "", model: "Sin color", price: 100 },
          { imei: "", model: "Color largo", price: 100, color: "a".repeat(51) },
        ],
      },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({
      imported: 2,
      errors: [{ row: 3, message: "El color puede tener hasta 50 caracteres" }],
    });

    const rows = await prisma.inventoryItem.findMany({
      where: { storeId: context.store!.id, model: { in: ["Con color", "Sin color", "Color largo"] } },
    });
    expect(rows.find((row) => row.model === "Con color")?.color).toBe("Medianoche");
    expect(rows.find((row) => row.model === "Sin color")?.color).toBe("");
    expect(rows.find((row) => row.model === "Color largo")).toBeUndefined();
  });
});
