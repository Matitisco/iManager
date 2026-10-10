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
    color: "Negro",
    condition: "USADO",
    grade: "A",
    batteryHealth: "90%",
    cost: 100,
    price: 200,
    status: "DISPONIBLE",
    ...overrides,
  };
}

describe("device quality", () => {
  it("stores a grade only for used devices and clears it when the condition becomes new", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const used = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment({ grade: "a+" }) });
    expect(used.statusCode).toBe(201);
    expect(used.json().inventoryItem).toMatchObject({ condition: "USADO", grade: "A+" });

    const blank = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment({ model: "Sin calidad", grade: "" }) });
    expect(blank.statusCode).toBe(201);
    expect(blank.json().inventoryItem.grade).toBe("");

    const fresh = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment({ model: "Nuevo", condition: "NUEVO", grade: "A+" }) });
    expect(fresh.statusCode).toBe(201);
    expect(fresh.json().inventoryItem).toMatchObject({ condition: "NUEVO", grade: "" });

    const invalid = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: equipment({ model: "Raro", grade: "excelente" }) });
    expect(invalid.statusCode).toBe(400);

    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/inventory/${used.json().inventoryItem.id}`,
      headers,
      payload: { condition: "NUEVO" },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().inventoryItem).toMatchObject({ condition: "NUEVO", grade: "" });

    const imported = await app.inject({
      method: "POST",
      url: "/api/inventory/import",
      headers,
      payload: {
        rows: [
          { imei: "", model: "Importado usado", price: 100, condition: "Usado", grade: "b" },
          { imei: "", model: "Importado nuevo", price: 100, condition: "Nuevo", grade: "A+" },
          { imei: "", model: "Importado mal", price: 100, condition: "USADO", grade: "Z" },
        ],
      },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({
      imported: 2,
      errors: [{ row: 3, message: "La calidad tiene que ser A+, A, B o C" }],
    });
    const rows = await prisma.inventoryItem.findMany({ where: { storeId: context.store!.id, model: { startsWith: "Importado" } } });
    expect(rows.find((row) => row.model === "Importado usado")).toMatchObject({ condition: "USADO", grade: "B" });
    expect(rows.find((row) => row.model === "Importado nuevo")).toMatchObject({ condition: "NUEVO", grade: "" });
  });

  it("stores the received trade-in as a used device with its optional quality", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const headers = headersFor(context);

    const rejected = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientName: "Ana",
        deviceLabel: "iPhone 14",
        amount: 1500,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 600, grade: "malo" },
      },
    });
    expect(rejected.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: "/api/operations/sales",
      headers,
      payload: {
        clientName: "Ana",
        deviceLabel: "iPhone 14",
        amount: 1500,
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        tradeIn: { deviceReceived: "iPhone 11", takeValue: 600, grade: "A" },
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().tradeIn.grade).toBe("A");
    const received = created.json().inventory.find((item: { model: string }) => item.model === "iPhone 11");
    expect(received).toMatchObject({ condition: "USADO", grade: "A", status: "EN_REVISION" });
    const stored = await prisma.inventoryItem.findFirstOrThrow({ where: { id: received.id } });
    expect(stored).toMatchObject({ condition: "USADO", grade: "A" });
  });
});
