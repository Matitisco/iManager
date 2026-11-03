import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();
const payload = {
  model: "QA security device", capacity: "128GB", color: "Black", condition: "USADO",
  grade: "A", batteryHealth: "90%", cost: 500, price: 800, status: "DISPONIBLE", currency: "USD",
};
const headers = (uid: string) => buildAuthHeaders({ uid, email: `${uid}@example.com`, name: uid });

async function fixture() {
  const a = await seedStoreContext({ firebaseUid: "qa-sec-1", email: "qa-sec-1@example.com" });
  const b = await seedStoreContext({ firebaseUid: "qa-sec-2", email: "qa-sec-2@example.com" });
  const own = await seedCatalogFixture(a.store!.id);
  const foreign = await seedCatalogFixture(b.store!.id);
  const supplier = await prisma.supplier.create({ data: { storeId: b.store!.id, name: "QA foreign supplier" } });
  const purchase = await prisma.stockPurchase.create({ data: { storeId: b.store!.id, supplierId: supplier.id, purchasedAt: new Date() } });
  await prisma.inventoryItem.update({ where: { id: foreign.inventoryItem.id }, data: { supplierId: supplier.id, stockPurchaseId: purchase.id } });
  const definition = await prisma.customFieldDefinition.create({ data: { storeId: b.store!.id, entity: "inventory", key: "qa_field", label: "Foreign field", type: "text" } });
  return { storeId: a.store!.id, foreignStoreId: b.store!.id, own, foreign, supplier, purchase, definition };
}

describe("inventory and purchases tenant authorization", () => {
  let data: Awaited<ReturnType<typeof fixture>>;
  beforeEach(async () => { data = await fixture(); });

  it("hides foreign equipment in detail, listings, filtered IDs and IMEI searches", async () => {
    const app = getApp();
    const foreignId = data.foreign.inventoryItem.id;
    for (const url of ["/api/inventory", "/api/inventory?skip=0&take=10", "/api/inventory/ids", `/api/inventory?skip=0&take=10&search=${data.foreign.inventoryItem.imei}`, `/api/inventory?skip=0&take=10&supplierId=${data.supplier.id}`, `/api/inventory?skip=0&take=10&categoryId=${data.foreign.inventoryCategory.id}`]) {
      const response = await app.inject({ method: "GET", url, headers: headers("qa-sec-1") });
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain(foreignId);
    }
    for (const id of [foreignId, "qa-missing-item"]) {
      const response = await app.inject({ method: "GET", url: `/api/inventory/${id}`, headers: headers("qa-sec-1") });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "No encontramos ese equipo" });
    }
    const own = await app.inject({ method: "GET", url: `/api/inventory/${data.own.inventoryItem.id}`, headers: headers("qa-sec-1") });
    expect(own.statusCode).toBe(200);
  });

  it("cannot edit, archive or restore equipment from another store", async () => {
    const app = getApp();
    const id = data.foreign.inventoryItem.id;
    expect((await app.inject({ method: "PATCH", url: `/api/inventory/${id}`, headers: headers("qa-sec-1"), payload: { model: "attacked", storeId: data.storeId } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/inventory/${id}`, headers: headers("qa-sec-1") })).statusCode).toBe(404);
    await prisma.inventoryItem.update({ where: { id }, data: { archivedAt: new Date() } });
    expect((await app.inject({ method: "POST", url: `/api/inventory/${id}/restore`, headers: headers("qa-sec-1") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/inventory?archived=1", headers: headers("qa-sec-1") })).body).not.toContain(id);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ storeId: data.foreignStoreId, model: data.foreign.inventoryItem.model, archivedAt: expect.any(Date) });
  });

  it("rejects foreign categories and suppliers on create and update without partial persistence", async () => {
    const app = getApp();
    for (const relation of [{ categoryId: data.foreign.inventoryCategory.id }, { supplierId: data.supplier.id }]) {
      const created = await app.inject({ method: "POST", url: "/api/inventory", headers: headers("qa-sec-1"), payload: { ...payload, ...relation } });
      expect(created.statusCode).toBe(404);
      const updated = await app.inject({ method: "PATCH", url: `/api/inventory/${data.own.inventoryItem.id}`, headers: headers("qa-sec-1"), payload: { model: "attacked", ...relation } });
      expect(updated.statusCode).toBe(404);
    }
    expect(await prisma.inventoryItem.count()).toBe(2);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.own.inventoryItem.id } })).model).toBe(data.own.inventoryItem.model);
    expect(await prisma.stockPurchase.count({ where: { storeId: data.storeId } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { storeId: data.storeId } })).toBe(0);
  });

  it("scopes category mutations and mixed bulk arrays to the session store", async () => {
    const app = getApp();
    const categoryId = data.foreign.inventoryCategory.id;
    for (const method of ["PATCH", "DELETE"] as const) {
      expect((await app.inject({ method, url: `/api/inventory/categories/${categoryId}`, headers: headers("qa-sec-1"), ...(method === "PATCH" ? { payload: { name: "attacked" } } : {}) })).statusCode).toBe(404);
    }
    expect((await app.inject({ method: "PATCH", url: "/api/inventory/categories/reorder", headers: headers("qa-sec-1"), payload: { ids: [data.own.inventoryCategory.id, categoryId] } })).statusCode).toBe(204);
    const ids = [data.own.inventoryItem.id, data.foreign.inventoryItem.id];
    expect((await app.inject({ method: "POST", url: "/api/inventory/bulk-move", headers: headers("qa-sec-1"), payload: { ids, categoryId } })).statusCode).toBe(404);
    const moved = await app.inject({ method: "POST", url: "/api/inventory/bulk-move", headers: headers("qa-sec-1"), payload: { ids, categoryId: null } });
    expect(moved.json()).toEqual({ count: 1 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.foreign.inventoryItem.id } })).categoryId).toBe(categoryId);
    expect(await prisma.inventoryCategory.findUniqueOrThrow({ where: { id: categoryId } })).toMatchObject({ name: data.foreign.inventoryCategory.name, sortOrder: 0, archivedAt: null });
  });

  it("ignores storeId and protected relation assignment in request bodies", async () => {
    const response = await getApp().inject({ method: "POST", url: "/api/inventory", headers: headers("qa-sec-1"), payload: { ...payload, storeId: data.foreignStoreId, id: data.foreign.inventoryItem.id, stockPurchaseId: data.purchase.id, supplier: { connect: { id: data.supplier.id } }, archivedAt: new Date().toISOString() } });
    expect(response.statusCode).toBe(201);
    const id = response.json().inventoryItem.id;
    expect(id).not.toBe(data.foreign.inventoryItem.id);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ storeId: data.storeId, supplierId: null, stockPurchaseId: null, archivedAt: null });
    expect((await getApp().inject({ method: "PATCH", url: `/api/inventory/${id}`, headers: headers("qa-sec-1"), payload: { storeId: data.foreignStoreId, stockPurchaseId: data.purchase.id, color: "Green" } })).statusCode).toBe(200);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).toMatchObject({ storeId: data.storeId, stockPurchaseId: null, color: "Green" });
  });

  it("rejects foreign suppliers in import and batch and isolates IMEI upsert", async () => {
    const app = getApp();
    const rejected = await app.inject({ method: "POST", url: "/api/inventory/import", headers: headers("qa-sec-1"), payload: { supplierId: data.supplier.id, definitions: [{ key: "new_field", label: "New", type: "text" }], rows: [{ model: "QA", price: 800 }] } });
    expect(rejected.statusCode).toBe(404);
    expect(await prisma.customFieldDefinition.count({ where: { storeId: data.storeId } })).toBe(0);
    const batch = await app.inject({ method: "POST", url: "/api/inventory/batch", headers: headers("qa-sec-1"), payload: { items: [{ ...payload, supplierId: data.supplier.id }, { ...payload, categoryId: data.foreign.inventoryCategory.id }] } });
    expect(batch.statusCode).toBe(201);
    expect(batch.json()).toMatchObject({ created: [], errors: [{ index: 0 }, { index: 1 }] });
    const imported = await app.inject({ method: "POST", url: "/api/inventory/import", headers: headers("qa-sec-1"), payload: { storeId: data.foreignStoreId, rows: [{ imei: data.foreign.inventoryItem.imei, model: "Own reimport", cost: 100, price: 800, supplierName: data.supplier.name }] } });
    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({ updated: 1, imported: 0 });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.foreign.inventoryItem.id } })).model).toBe(data.foreign.inventoryItem.model);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.own.inventoryItem.id } })).model).toBe("Own reimport");
    expect(await prisma.supplier.count({ where: { storeId: data.storeId, name: data.supplier.name } })).toBe(1);
  });

  it("does not reveal or mutate foreign suppliers, purchases or custom fields", async () => {
    const app = getApp();
    const ownSupplier = await prisma.supplier.create({ data: { storeId: data.storeId, name: "Own supplier" } });
    for (const url of [`/api/suppliers/${data.supplier.id}`, `/api/suppliers/${data.supplier.id}/purchases`, `/api/suppliers/${data.supplier.id}/purchases/${data.purchase.id}`, `/api/suppliers/${ownSupplier.id}/purchases/${data.purchase.id}`]) {
      expect((await app.inject({ method: "GET", url, headers: headers("qa-sec-1") })).statusCode).toBe(404);
    }
    for (const [method, suffix, body] of [["PATCH", "", { name: "attacked" }], ["DELETE", "", undefined]] as const) {
      expect((await app.inject({ method, url: `/api/suppliers/${data.supplier.id}${suffix}`, headers: headers("qa-sec-1"), payload: body })).statusCode).toBe(404);
    }
    const archivedAt = new Date();
    await prisma.supplier.update({ where: { id: data.supplier.id }, data: { deletedAt: archivedAt } });
    expect((await app.inject({ method: "POST", url: `/api/suppliers/${data.supplier.id}/restore`, headers: headers("qa-sec-1") })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/suppliers?archived=1", headers: headers("qa-sec-1") })).body).not.toContain(data.supplier.id);
    for (const method of ["PATCH", "DELETE"] as const) {
      expect((await app.inject({ method, url: `/api/custom-field-definitions/${data.definition.id}`, headers: headers("qa-sec-1"), ...(method === "PATCH" ? { payload: { label: "attacked" } } : {}) })).statusCode).toBe(404);
    }
    expect((await app.inject({ method: "GET", url: "/api/custom-field-definitions", headers: headers("qa-sec-1") })).json()).toEqual({ definitions: [] });
    expect(await prisma.supplier.findUniqueOrThrow({ where: { id: data.supplier.id } })).toMatchObject({ name: data.supplier.name, deletedAt: archivedAt });
    expect(await prisma.customFieldDefinition.findUniqueOrThrow({ where: { id: data.definition.id } })).toMatchObject({ label: "Foreign field", archivedAt: null });
  });

  it("isolates stock counts, scan IMEIs and adjustment arrays", async () => {
    const app = getApp();
    const foreignCount = await app.inject({ method: "POST", url: "/api/stock-counts", headers: headers("qa-sec-2") });
    expect(foreignCount.statusCode).toBe(201);
    const foreignId = foreignCount.json().count.id;
    for (const [method, suffix, body] of [["GET", "", undefined], ["POST", "/scans", { imei: data.foreign.inventoryItem.imei }], ["POST", "/close", undefined], ["POST", "/resolve", { mode: "ADJUST", missingIds: [data.foreign.inventoryItem.id] }]] as const) {
      expect((await app.inject({ method, url: `/api/stock-counts/${foreignId}${suffix}`, headers: headers("qa-sec-1"), payload: body })).statusCode).toBe(404);
    }
    const ownCount = await app.inject({ method: "POST", url: "/api/stock-counts", headers: headers("qa-sec-1") });
    expect(ownCount.statusCode).toBe(201);
    const id = ownCount.json().count.id;
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${id}/close`, headers: headers("qa-sec-1") })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${id}/resolve`, headers: headers("qa-sec-1"), payload: { mode: "ADJUST", missingIds: [data.own.inventoryItem.id, data.foreign.inventoryItem.id], surplusImeis: [] } })).statusCode).toBe(200);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.own.inventoryItem.id } })).archivedAt).not.toBeNull();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: data.foreign.inventoryItem.id } })).archivedAt).toBeNull();
    expect((await prisma.stockCount.findUniqueOrThrow({ where: { id: foreignId } })).status).toBe("OPEN");
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${foreignId}/close`, headers: headers("qa-sec-2") })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/stock-counts/${foreignId}`, headers: headers("qa-sec-1") })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${foreignId}/resolve`, headers: headers("qa-sec-1"), payload: { mode: "ADJUST", missingIds: [data.foreign.inventoryItem.id] } })).statusCode).toBe(404);
    expect((await prisma.stockCount.findUniqueOrThrow({ where: { id: foreignId } })).resolution).toBeNull();
  });

  it("treats an IMEI found only in the other store as unknown locally", async () => {
    const app = getApp();
    const imei = "490154203237518";
    await prisma.inventoryItem.update({ where: { id: data.foreign.inventoryItem.id }, data: { imei } });
    const searched = await app.inject({ method: "GET", url: `/api/inventory?take=10&search=${imei}`, headers: headers("qa-sec-1") });
    expect(searched.json()).toMatchObject({ items: [], total: 0 });
    const started = await app.inject({ method: "POST", url: "/api/stock-counts", headers: headers("qa-sec-1") });
    const id = started.json().count.id;
    const scanned = await app.inject({ method: "POST", url: `/api/stock-counts/${id}/scans`, headers: headers("qa-sec-1"), payload: { imei } });
    expect(scanned.statusCode).toBe(200);
    expect(scanned.body).not.toContain(data.foreign.inventoryItem.id);
    const scan = await prisma.stockCountScan.findFirstOrThrow({ where: { stockCountId: id, imei } });
    expect(scan.inventoryItemId).toBeNull();
    expect(scan.model).toBeNull();
    const imported = await app.inject({ method: "POST", url: "/api/inventory/import", headers: headers("qa-sec-1"), payload: { rows: [{ imei, model: "Own new device", cost: 100, price: 800 }] } });
    expect(imported.json()).toMatchObject({ imported: 1, updated: 0 });
    expect(await prisma.inventoryItem.count({ where: { imei } })).toBe(2);
  });

  it("rejects mixed foreign IDs when changing catalog visibility", async () => {
    const result = await getApp().inject({ method: "PATCH", url: "/api/catalog/items", headers: headers("qa-sec-1"), payload: { ids: [data.own.inventoryItem.id, data.foreign.inventoryItem.id], visible: true } });
    expect(result.statusCode).toBe(404);
    expect(await prisma.inventoryItem.count({ where: { catalogVisible: true } })).toBe(0);
  });

  it("requires authentication, membership and inventory access before processing uploads", async () => {
    const user = await prisma.user.create({ data: { firebaseUid: "qa-sec-3", email: "qa-sec-3@example.com" } });
    await prisma.storeMember.create({ data: { storeId: data.storeId, userId: user.id, role: "STAFF", sections: ["sales"], isDefault: true } });
    await seedStoreContext({ firebaseUid: "qa-sec-4", email: "qa-sec-4@example.com", createStore: false });
    const targets = [
      ["GET", "/api/inventory", undefined],
      ["GET", "/api/suppliers", undefined],
      ["GET", "/api/stock-counts", undefined],
      ["GET", "/api/custom-field-definitions", undefined],
      ["POST", "/api/inventory/batch", { items: [payload] }],
      ["POST", "/api/inventory/import", { rows: [{ model: "QA" }] }],
      ["POST", "/api/import/analyze-text", { text: "iPhone 13" }],
      ["POST", "/api/import/analyze", { section: "inventory", sheets: [{ name: "QA", rows: [["Modelo"], ["iPhone 13"]] }] }],
      ["POST", "/api/import/apply", { section: "inventory", sheets: [{ name: "QA", rows: [] }], plan: [{ name: "QA", include: true, condition: "", headerRow: 0, dataStartRow: 1, dataEndRow: 1, mapping: [], splitModelCapacity: false, batteryAsPercent: false, priceCurrency: "" }] }],
    ] as const;
    for (const [method, url, body] of targets) {
      for (const uid of [null, "qa-sec-3", "qa-sec-4"]) {
        const response = await getApp().inject({ method, url, headers: uid ? headers(uid) : {}, payload: body });
        expect(response.statusCode, `${method} ${url} ${uid}`).toBe(uid ? 403 : 401);
      }
    }
  });

  it("keeps staff stock scanning but denies opening, closing and resolving counts", async () => {
    const app = getApp();
    const user = await prisma.user.create({ data: { firebaseUid: "qa-sec-3", email: "qa-sec-3@example.com" } });
    await prisma.storeMember.create({ data: { storeId: data.storeId, userId: user.id, role: "STAFF", sections: ["inventory"], isDefault: true } });
    const started = await app.inject({ method: "POST", url: "/api/stock-counts", headers: headers("qa-sec-1") });
    const id = started.json().count.id;
    expect((await app.inject({ method: "POST", url: "/api/stock-counts", headers: headers("qa-sec-3") })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${id}/scans`, headers: headers("qa-sec-3"), payload: { imei: data.own.inventoryItem.imei } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${id}/close`, headers: headers("qa-sec-3") })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${id}/resolve`, headers: headers("qa-sec-3"), payload: { mode: "ADJUST" } })).statusCode).toBe(403);
  });
});

describe("inventory monetary authorization", () => {
  async function setup(role: "STAFF" | "MANAGER", sensitiveAccess: boolean | null = null) {
    const owner = await seedStoreContext({ firebaseUid: "qa-sec-1", email: "qa-sec-1@example.com" });
    const user = await prisma.user.create({ data: { firebaseUid: "qa-sec-3", email: "qa-sec-3@example.com", displayName: "QA member" } });
    await prisma.storeMember.create({ data: { storeId: owner.store!.id, userId: user.id, role, sensitiveAccess, sections: ["inventory", "reports"], isDefault: true } });
    const item = await prisma.inventoryItem.create({ data: { ...payload, storeId: owner.store!.id, imei: "359123456789012" } });
    return { item, storeId: owner.store!.id };
  }

  it.each(["STAFF", "MANAGER"] as const)("rejects currency-only PATCH by %s without sensitive access", async role => {
    const { item, storeId } = await setup(role, false);
    const result = await getApp().inject({ method: "PATCH", url: `/api/inventory/${item.id}`, headers: headers("qa-sec-3"), payload: { currency: "ARS", color: "attacked" } });
    expect(result.statusCode).toBe(403);
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ currency: "USD", color: "Black" });
    expect(await prisma.auditEvent.count({ where: { storeId } })).toBe(0);
  });

  it("rejects currency changes even with unchanged numeric amounts", async () => {
    const { item } = await setup("STAFF");
    const result = await getApp().inject({ method: "PATCH", url: `/api/inventory/${item.id}`, headers: headers("qa-sec-3"), payload: { currency: "ARS", cost: 500, price: 800 } });
    expect(result.statusCode).toBe(403);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).currency).toBe("USD");
  });

  it("compares an unstamped currency with the store currency", async () => {
    const { item } = await setup("STAFF");
    await prisma.inventoryItem.update({ where: { id: item.id }, data: { currency: null } });
    const changed = await getApp().inject({ method: "PATCH", url: `/api/inventory/${item.id}`, headers: headers("qa-sec-3"), payload: { currency: "USD" } });
    expect(changed.statusCode).toBe(403);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).currency).toBeNull();
    const same = await getApp().inject({ method: "PATCH", url: `/api/inventory/${item.id}`, headers: headers("qa-sec-3"), payload: { currency: "ARS", color: "Green" } });
    expect(same.statusCode).toBe(200);
  });

  it("keeps staff financial visibility, nonfinancial edits and same-currency saves", async () => {
    const { item } = await setup("STAFF");
    const result = await getApp().inject({ method: "PATCH", url: `/api/inventory/${item.id}`, headers: headers("qa-sec-3"), payload: { currency: "USD", price: 800, cost: 500, color: "Green" } });
    expect(result.statusCode).toBe(200);
    expect(result.json().inventoryItem).toMatchObject({ price: 800, cost: 500, currency: "USD", color: "Green" });
  });

  it("serves real loopback HTTP requests against the local database", async () => {
    const { item } = await setup("STAFF");
    const app = getApp();
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const response = await fetch(`${address}/api/inventory/${item.id}`, {
      method: "PATCH", headers: { ...headers("qa-sec-3"), "content-type": "application/json" },
      body: JSON.stringify({ currency: "ARS" }),
    });
    expect(response.status).toBe(403);
    await response.text();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).currency).toBe("USD");
  });

  it.each(["qa-sec-1", "qa-sec-3"])("allows currency changes with sensitive permission (%s)", async uid => {
    const { item } = await setup("STAFF", true);
    const result = await getApp().inject({ method: "PATCH", url: `/api/inventory/${item.id}`, headers: headers(uid), payload: { currency: "ARS" } });
    expect(result.statusCode).toBe(200);
    expect(result.json().inventoryItem.currency).toBe("ARS");
  });
});
