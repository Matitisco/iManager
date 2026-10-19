import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedCatalogFixture, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();
const headers = () => buildAuthHeaders();

function inject(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object, auth = headers()) {
  return getApp().inject({ method, url, headers: auth, ...(payload ? { payload } : {}) });
}

async function box() {
  const response = await inject("POST", "/api/cash", { name: "ARS EFECTIVO", currency: "ARS", method: "EFECTIVO", opening: 0 });
  expect(response.statusCode, response.body).toBe(200);
  const opened = await inject("POST", `/api/cash/${response.json().id}/open`);
  expect(opened.statusCode, opened.body).toBe(200);
  return response.json().id as string;
}

async function balance(id: string) {
  return Number((await prisma.cashRegister.findUniqueOrThrow({ where: { id } })).balance);
}

async function sell(storeId: string, clientId: string, productId: string, amount: number, extra: object = {}) {
  const response = await inject("POST", "/api/operations/sales", {
    clientId,
    productId,
    amount,
    paymentMethod: "EFECTIVO",
    status: "COMPLETADA",
    ...extra,
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().sale.id as string;
}

async function item(storeId: string, categoryId: string, imei: string, supplierId?: string) {
  return prisma.inventoryItem.create({
    data: {
      storeId,
      categoryId,
      supplierId,
      imei,
      model: "iPhone 13",
      capacity: "128GB",
      color: "Blue",
      condition: "USADO",
      grade: "A",
      batteryHealth: "90%",
      cost: 700,
      price: 1500,
      status: "DISPONIBLE",
    },
  });
}

async function claim(saleId: string, auth = headers()) {
  const response = await inject("POST", "/api/returns", {
    saleId,
    reason: "No enciende",
    openedOn: "2026-10-19",
  }, auth);
  expect(response.statusCode, response.body).toBe(201);
  return response.json().return as { id: string; code: string };
}

describe("devoluciones, notas de crédito y RMA", () => {
  it("reintegra en caja, vuelve el equipo con otro estado y resta el margen en reportes", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const register = await box();
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    expect(await balance(register)).toBe(1200);

    const staff = await prisma.user.create({ data: { firebaseUid: "returns-staff", email: "returns-staff@example.com", displayName: "Vendedor" } });
    await prisma.storeMember.create({ data: { userId: staff.id, storeId: store.store!.id, role: "STAFF", sections: ["sales"], sensitiveAccess: false, isDefault: true } });
    const staffAuth = buildAuthHeaders({ uid: "returns-staff", email: "returns-staff@example.com", name: "Vendedor" });
    const opened = await claim(saleId, staffAuth);

    const denied = await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REINTEGRO",
      settlement: "REINTEGRO",
      amount: 1200,
      destination: "STOCK",
      stockStatus: "EN_REVISION",
    }, staffAuth);
    expect(denied.statusCode).toBe(403);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("VENDIDO");
    expect(await prisma.clientPayment.count({ where: { kind: "DEVOLUCION" } })).toBe(0);

    const sameStatus = await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REINTEGRO",
      settlement: "REINTEGRO",
      amount: 1200,
      destination: "STOCK",
      stockStatus: "DISPONIBLE",
    });
    expect(sameStatus.statusCode).toBe(400);

    const resolved = await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REINTEGRO",
      settlement: "REINTEGRO",
      amount: 1200,
      destination: "STOCK",
      stockStatus: "EN_REVISION",
    });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(await balance(register)).toBe(0);
    expect(await prisma.cashMovement.findFirst({ where: { sourceType: "return", sourceId: opened.id } })).toMatchObject({ kind: "DEVOLUCION" });
    expect(await prisma.clientPayment.findFirst({ where: { saleId, kind: "DEVOLUCION" } })).toMatchObject({ method: "EFECTIVO" });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("EN_REVISION");
    const audit = await prisma.auditEvent.findFirst({ where: { action: "return.resolved", entityId: opened.id } });
    expect(audit?.detail).toContain("reintegro");
    expect(audit?.detail).toContain(opened.code);

    const profit = await inject("GET", "/api/reports/net-profit?from=2020-01-01&to=2099-12-31");
    expect(profit.statusCode, profit.body).toBe(200);
    expect(profit.json()).toMatchObject({ grossProfit: 0, revenue: 0, cost: 0 });
    const overview = await inject("GET", "/api/reports/overview?rangeKey=all_time");
    expect(overview.statusCode, overview.body).toBe(200);
    expect(overview.json().overview.summary).toMatchObject({ revenue: 1200, returnsCount: 1, returnsAmount: 1200 });
  });

  it("aplica una nota de crédito a una venta posterior y no la deja usar en otra tienda", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const register = await box();
    const first = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(first);
    const resolved = await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REINTEGRO",
      settlement: "NOTA_CREDITO",
      amount: 1200,
      destination: "STOCK",
      stockStatus: "DEVUELTO",
    });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(await balance(register)).toBe(1200);
    expect(await prisma.cashMovement.count({ where: { sourceType: "return" } })).toBe(0);
    const note = await prisma.creditNote.findFirstOrThrow({ where: { returnCaseId: opened.id } });
    expect(note.status).toBe("ABIERTA");

    const other = await seedStoreContext({ firebaseUid: "other-returns", email: "other-returns@example.com" });
    const otherCatalog = await seedCatalogFixture(other.store!.id);
    const otherAuth = buildAuthHeaders({ uid: "other-returns", email: "other-returns@example.com" });
    const leaked = await inject("POST", "/api/operations/sales", {
      clientId: otherCatalog.client.id,
      productId: otherCatalog.inventoryItem.id,
      amount: 1200,
      paymentMethod: "EFECTIVO",
      status: "COMPLETADA",
      creditNoteIds: [note.id],
    }, otherAuth);
    expect(leaked.statusCode).toBe(404);
    expect(await prisma.creditNoteApplication.count()).toBe(0);

    const secondItem = await item(store.store!.id, catalog.inventoryCategory.id, "359123456789013");
    const second = await sell(store.store!.id, catalog.client.id, secondItem.id, 1500, { creditNoteIds: [note.id] });
    expect(await balance(register)).toBe(1500);
    const applied = await prisma.creditNote.findUniqueOrThrow({ where: { id: note.id } });
    expect(Number(applied.remaining)).toBe(0);
    expect(applied.status).toBe("APLICADA");
    expect(await prisma.creditNoteApplication.findFirst({ where: { creditNoteId: note.id, saleId: second } })).toBeTruthy();
    const creditAudit = await prisma.auditEvent.findFirst({ where: { action: "credit.applied" } });
    expect(creditAudit?.detail).toContain("nota de crédito");
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: second } });
    expect(Number(sale.amount)).toBe(1500);
  });

  it("sigue el RMA hasta que el proveedor devuelve el equipo", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const supplier = await inject("POST", "/api/suppliers", { name: "Mayorista Centro" });
    expect(supplier.statusCode, supplier.body).toBe(201);
    const supplierId = supplier.json().supplier.id as string;
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId } });
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const resolved = await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "CAMBIO",
      settlement: "NOTA_CREDITO",
      amount: 1200,
      destination: "PROVEEDOR",
    });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().return).toMatchObject({ status: "EN_PROVEEDOR", rmaStatus: "ENVIADO" });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("EN_RMA");
    const detail = await inject("GET", `/api/suppliers/${supplierId}`);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.body).toContain("En RMA con el proveedor");

    const review = await inject("POST", `/api/returns/${opened.id}/rma`, { status: "EN_REVISION" });
    expect(review.statusCode, review.body).toBe(200);
    const back = await inject("POST", `/api/returns/${opened.id}/rma`, { status: "RECIBIDO", stockStatus: "DEVUELTO" });
    expect(back.statusCode, back.body).toBe(200);
    expect(back.json().return.status).toBe("RESUELTO");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("DEVUELTO");
  });

  it("resuelve una reparación en garantía sin mover plata ni el stock", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const resolved = await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REPARACION",
      settlement: "NINGUNO",
      amount: 0,
      destination: "CLIENTE",
    });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(resolved.json().return.status).toBe("RESUELTO");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("VENDIDO");
    expect(await prisma.clientPayment.count({ where: { kind: "DEVOLUCION" } })).toBe(0);
    expect(await prisma.creditNote.count()).toBe(0);
  });

  it("archiva solo reclamos abiertos y aísla la tienda", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const archived = await inject("DELETE", `/api/returns/${opened.id}`);
    expect(archived.statusCode).toBe(204);
    const active = await inject("GET", "/api/returns");
    expect(active.json().returns).toEqual([]);
    const stored = await inject("GET", "/api/returns?archived=1");
    expect(stored.json().returns).toHaveLength(1);
    const restored = await inject("POST", `/api/returns/${opened.id}/restore`);
    expect(restored.statusCode, restored.body).toBe(200);
    expect((await inject("GET", "/api/returns")).json().returns).toHaveLength(1);

    await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REPARACION",
      settlement: "NINGUNO",
      amount: 0,
      destination: "CLIENTE",
    });
    expect((await inject("DELETE", `/api/returns/${opened.id}`)).statusCode).toBe(409);

    const other = await seedStoreContext({ firebaseUid: "other-archive", email: "other-archive@example.com" });
    const otherAuth = buildAuthHeaders({ uid: "other-archive", email: "other-archive@example.com" });
    expect((await inject("GET", "/api/returns", undefined, otherAuth)).json().returns).toEqual([]);
    expect((await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REPARACION",
      settlement: "NINGUNO",
      amount: 0,
      destination: "CLIENTE",
    }, otherAuth)).statusCode).toBe(404);
    expect(other.store!.id).not.toBe(store.store!.id);
  });
});
