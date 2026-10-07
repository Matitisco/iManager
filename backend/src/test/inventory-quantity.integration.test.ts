import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();
const item = {
  imei: "quantity-device", model: "iPhone 13", capacity: "128GB", color: "Azul",
  condition: "USADO", grade: "A", batteryHealth: "87%", cost: 100,
  price: 200, status: "DISPONIBLE",
};

async function seedHeaders(firebaseUid?: string) {
  const context = await seedStoreContext({ firebaseUid });
  return {
    "content-type": "application/json",
    ...buildAuthHeaders({ uid: context.user.firebaseUid }),
  };
}

describe("inventory quantity persistence", () => {
  it("defaults to one and returns explicit quantities in both listings", async () => {
    const app = getApp();
    const headers = await seedHeaders();
    const created = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: item });
    expect(created.statusCode).toBe(201);
    const id = created.json().inventoryItem.id as string;
    expect(created.json().inventoryItem.quantity).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity).toBe(1);

    const explicit = await app.inject({
      method: "POST", url: "/api/inventory", headers,
      payload: { ...item, imei: "quantity-max", quantity: 2147483647 },
    });
    expect(explicit.statusCode).toBe(201);
    expect(explicit.json().inventoryItem.quantity).toBe(2147483647);
    const full = await app.inject({ method: "GET", url: "/api/inventory", headers });
    const paged = await app.inject({ method: "GET", url: "/api/inventory?skip=0&take=10", headers });
    expect(full.statusCode).toBe(200);
    expect(paged.statusCode).toBe(200);
    for (const rows of [full.json().inventory, paged.json().items]) {
      expect(rows).toEqual(expect.arrayContaining([
        expect.objectContaining({ id, quantity: 1 }),
        expect.objectContaining({ id: explicit.json().inventoryItem.id, quantity: 2147483647 }),
      ]));
    }
  });

  it("persists edits and keeps the quantity when a PATCH omits it", async () => {
    const app = getApp();
    const headers = await seedHeaders();
    const created = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: item });
    const id = created.json().inventoryItem.id as string;
    const edited = await app.inject({ method: "PATCH", url: `/api/inventory/${id}`, headers, payload: { quantity: 7 } });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().inventoryItem).toMatchObject({ quantity: 7, price: 200 });
    const otherEdit = await app.inject({ method: "PATCH", url: `/api/inventory/${id}`, headers, payload: { price: 250 } });
    expect(otherEdit.statusCode).toBe(200);
    expect(otherEdit.json().inventoryItem).toMatchObject({ quantity: 7, price: 250 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity).toBe(7);
  });

  it("rejects invalid create and PATCH quantities without changing stored data", async () => {
    const app = getApp();
    const headers = await seedHeaders();
    const created = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: { ...item, quantity: 4 } });
    const id = created.json().inventoryItem.id as string;
    for (const quantity of [0, -1, 1.5, 2147483648, "3", null]) {
      const create = await app.inject({ method: "POST", url: "/api/inventory", headers, payload: { ...item, imei: `invalid-${quantity}`, quantity } });
      const patch = await app.inject({ method: "PATCH", url: `/api/inventory/${id}`, headers, payload: { quantity } });
      expect(create.statusCode).toBe(400);
      expect(patch.statusCode).toBe(400);
    }
    expect(await prisma.inventoryItem.count()).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity).toBe(4);
  });

  it("imports quantities, defaults new rows and preserves omitted quantities on updates", async () => {
    const app = getApp();
    const headers = await seedHeaders();
    const imported = await app.inject({
      method: "POST", url: "/api/inventory/import", headers,
      payload: { rows: [
        { imei: "import-default", model: "iPhone 13", price: 200 },
        { imei: "import-explicit", model: "iPhone 14", price: 300, quantity: "6" },
      ] },
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({ imported: 2, updated: 0, errors: [] });
    const updates = await app.inject({
      method: "POST", url: "/api/inventory/import", headers,
      payload: { rows: [
        { imei: "import-default", model: "iPhone 13", price: 210, quantity: 3 },
        { imei: "import-explicit", model: "iPhone 14", price: 310 },
      ] },
    });
    expect(updates.json()).toMatchObject({ imported: 0, updated: 2, errors: [] });
    const rows = await prisma.inventoryItem.findMany();
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ imei: "import-default", quantity: 3 }),
      expect.objectContaining({ imei: "import-explicit", quantity: 6 }),
    ]));
  });

  it("reports invalid import quantities per row and still saves valid rows", async () => {
    const app = getApp();
    const headers = await seedHeaders();
    const invalid = [0, -1, "1.5", "abc", 2147483648, ""];
    const response = await app.inject({
      method: "POST", url: "/api/inventory/import", headers,
      payload: { rows: [
        ...invalid.map((quantity, index) => ({ imei: `bad-import-${index}`, model: "iPhone 13", price: 200, quantity })),
        { imei: "good-import", model: "iPhone 14", price: 300, quantity: 2 },
      ] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ imported: 1, updated: 0 });
    expect(response.json().errors).toHaveLength(invalid.length);
    expect(response.json().errors.map((error: { row: number }) => error.row)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await prisma.inventoryItem.findMany()).toEqual([expect.objectContaining({ imei: "good-import", quantity: 2 })]);
  });

  it("isolates quantity edits and imports by store", async () => {
    const app = getApp();
    const ownerHeaders = await seedHeaders();
    const foreignHeaders = await seedHeaders("quantity-foreign-owner");
    const created = await app.inject({ method: "POST", url: "/api/inventory", headers: ownerHeaders, payload: { ...item, quantity: 4 } });
    const id = created.json().inventoryItem.id as string;
    const forbidden = await app.inject({ method: "PATCH", url: `/api/inventory/${id}`, headers: foreignHeaders, payload: { quantity: 9 } });
    expect(forbidden.statusCode).toBe(404);
    const imported = await app.inject({ method: "POST", url: "/api/inventory/import", headers: foreignHeaders, payload: { rows: [{ ...item, quantity: 8 }] } });
    expect(imported.json()).toMatchObject({ imported: 1, updated: 0, errors: [] });
    const foreignList = await app.inject({ method: "GET", url: "/api/inventory?take=10", headers: foreignHeaders });
    expect(foreignList.json().items).toEqual([expect.objectContaining({ quantity: 8 })]);
    expect(foreignList.json().items[0].id).not.toBe(id);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity).toBe(4);
  });
});
