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

  it.each(['CAMBIO', 'REPARACION'])('recibe físicamente un RMA rechazado de %s sin duplicar compensación', async resolution => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const catalog = await seedCatalogFixture(storeId);
    const supplier = await prisma.supplier.create({ data: { storeId, name: 'Proveedor ficticio' } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId: supplier.id } });
    const saleId = await sell(storeId, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    expect((await inject('POST', `/api/returns/${opened.id}/resolve`, { resolution, settlement: resolution === 'CAMBIO' ? 'NOTA_CREDITO' : 'NINGUNO', amount: resolution === 'CAMBIO' ? 1200 : 0, destination: 'PROVEEDOR' })).statusCode).toBe(200);
    const rejected = await inject('POST', `/api/returns/${opened.id}/rma`, { status: 'RECHAZADO', note: 'Falta devolver el equipo' });
    expect(rejected.statusCode).toBe(200);
    const before = await prisma.returnCase.findUniqueOrThrow({ where: { id: opened.id } });
    expect((await inject('POST', `/api/returns/${opened.id}/rma`, { status: 'APROBADO' })).statusCode).toBeGreaterThanOrEqual(400);
    const received = await inject('POST', `/api/returns/${opened.id}/rma`, { status: 'RECIBIDO', stockStatus: 'EN_REVISION', note: 'Llegó físicamente' });
    expect(received.statusCode, received.body).toBe(200);
    expect(received.json().return).toMatchObject({ status: 'RESUELTO', rmaStatus: 'RECIBIDO' });
    const after = await prisma.returnCase.findUniqueOrThrow({ where: { id: opened.id } });
    expect(after.resolvedAt).toEqual(before.resolvedAt);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe(resolution === 'CAMBIO' ? 'EN_REVISION' : 'VENDIDO');
    const events = await prisma.returnEvent.findMany({ where: { caseId: opened.id } });
    expect(events.map(event => event.status)).toEqual(expect.arrayContaining(['RECHAZADO', 'RECIBIDO']));
    expect(await prisma.creditNote.count({ where: { returnCaseId: opened.id } })).toBe(resolution === 'CAMBIO' ? 1 : 0);
    expect((await inject('POST', `/api/returns/${opened.id}/rma`, { status: 'RECIBIDO', stockStatus: 'EN_REVISION' })).statusCode).toBeGreaterThanOrEqual(400);
    expect(await prisma.returnEvent.count({ where: { caseId: opened.id, status: 'RECIBIDO' } })).toBe(1);
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

  it("anula sin borrar, impide restaurar y aísla la tienda", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const archived = await inject("DELETE", `/api/returns/${opened.id}`, { reason: "Duplicado" });
    expect(archived.statusCode).toBe(204);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: opened.id, action: "return.cancelled" } })).toMatchObject({ reason: "Duplicado" });
    const active = await inject("GET", "/api/returns");
    expect(active.json().returns).toEqual([]);
    const stored = await inject("GET", "/api/returns?archived=1");
    expect(stored.json().returns).toHaveLength(1);
    const restored = await inject("POST", `/api/returns/${opened.id}/restore`);
    expect(restored.statusCode, restored.body).toBe(409);
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: opened.id } })).status).toBe("ANULADO");
    expect(stored.json().returns[0].events.at(-1)).toMatchObject({ status: "ANULADO", note: "Duplicado" });
    expect((await inject("PATCH", `/api/returns/${opened.id}`, { reason: "Cambio" })).statusCode).toBe(404);
    expect((await inject("POST", `/api/returns/${opened.id}/resolve`, {
      resolution: "REPARACION",
      settlement: "NINGUNO",
      amount: 0,
      destination: "CLIENTE",
    })).statusCode).toBe(404);

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


describe("reclamos #483-g", () => {
  it("edita datos y guarda estado/nota con fecha, sin aceptar estados financieros por PATCH", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const edited = await inject("PATCH", `/api/returns/${opened.id}`, { reason: "Falla intermitente", openedOn: "2026-10-20", diagnosis: "Revisar batería", status: "EN_DIAGNOSTICO", note: "Cliente dejó el equipo" });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json().return).toMatchObject({ reason: "Falla intermitente", openedOn: "2026-10-20", diagnosis: "Revisar batería", status: "EN_DIAGNOSTICO" });
    expect(edited.json().return.events.at(-1)).toMatchObject({ status: "EN_DIAGNOSTICO", note: "Cliente dejó el equipo", createdAt: expect.any(String) });
    for (const payload of [{ status: "RESUELTO" }, { status: "ANULADO" }, { openedOn: "2026-02-31" }, { reason: " " }, { note: "a".repeat(281) }, { saleId: "other" }, {}]) {
      expect((await inject("PATCH", `/api/returns/${opened.id}`, payload)).statusCode).toBe(400);
    }
    const other = await seedStoreContext({ firebaseUid: "claim-other", email: "claim-other@example.com" });
    const auth = buildAuthHeaders({ uid: "claim-other", email: "claim-other@example.com" });
    expect((await inject("PATCH", `/api/returns/${opened.id}`, { reason: "Fuera de tienda" }, auth)).statusCode).toBe(404);
    expect((await inject("DELETE", `/api/returns/${opened.id}`, undefined, auth)).statusCode).toBe(404);
    expect(other.store!.id).not.toBe(store.store!.id);
    expect((await prisma.returnCase.findUniqueOrThrow({ where: { id: opened.id } })).reason).toBe("Falla intermitente");
  });

  it("anulado no suma en reportes, conserva movimientos históricos y queda visible tras recargar", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const register = await box();
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const result = await inject("POST", `/api/returns/${opened.id}/resolve`, { resolution: "REINTEGRO", settlement: "REINTEGRO", amount: 1200, destination: "STOCK", stockStatus: "EN_REVISION", note: "Reintegro acordado", diagnosis: "Batería dañada" });
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().return.events.at(-1)).toMatchObject({ note: "Reintegro acordado" });
    expect(result.json().return.diagnosis).toBe("Batería dañada");
    expect((await inject("DELETE", `/api/returns/${opened.id}`)).statusCode).toBe(204);
    expect((await inject("GET", "/api/returns")).json().returns).toEqual([]);
    const archived = (await inject("GET", "/api/returns?archived=1")).json().returns;
    expect(archived).toHaveLength(1);
    expect(archived[0]).toMatchObject({ id: opened.id, status: "ANULADO", deletedAt: expect.any(String) });
    expect(await balance(register)).toBe(0);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: catalog.inventoryItem.id } })).status).toBe("EN_REVISION");
    const overview = await inject("GET", "/api/reports/overview?rangeKey=all_time");
    expect(overview.json().overview.summary).toMatchObject({ returnsCount: 0, returnsAmount: 0 });
    const profit = await inject("GET", "/api/reports/net-profit?from=2020-01-01&to=2099-12-31");
    expect(profit.json()).toMatchObject({ revenue: 1200, cost: 800, grossProfit: 400 });
    // Explicit state exclusion also protects legacy rows without a deletion timestamp.
    await prisma.returnCase.update({ where: { id: opened.id }, data: { deletedAt: null } });
    expect((await inject("GET", "/api/reports/overview?rangeKey=all_time")).json().overview.summary).toMatchObject({ returnsCount: 0, returnsAmount: 0 });
    expect((await inject("GET", "/api/reports/net-profit?from=2020-01-01&to=2099-12-31")).json()).toMatchObject({ revenue: 1200 });
    expect((await inject("GET", "/api/returns")).json().returns).toEqual([]);
    expect((await inject("GET", "/api/returns?archived=1")).json().returns).toHaveLength(1);
  });

  it("mantiene el permiso sensible para eliminar y guarda notas del RMA", async () => {
    const store = await seedStoreContext();
    const catalog = await seedCatalogFixture(store.store!.id);
    const supplier = await prisma.supplier.create({ data: { storeId: store.store!.id, name: "Mayorista" } });
    await prisma.inventoryItem.update({ where: { id: catalog.inventoryItem.id }, data: { supplierId: supplier.id } });
    const saleId = await sell(store.store!.id, catalog.client.id, catalog.inventoryItem.id, 1200);
    const opened = await claim(saleId);
    const staff = await prisma.user.create({ data: { firebaseUid: "claim-staff", email: "claim-staff@example.com" } });
    await prisma.storeMember.create({ data: { storeId: store.store!.id, userId: staff.id, role: "STAFF", sections: ["sales"], sensitiveAccess: false, isDefault: true } });
    const auth = buildAuthHeaders({ uid: "claim-staff", email: "claim-staff@example.com" });
    expect((await inject("DELETE", `/api/returns/${opened.id}`, undefined, auth)).statusCode).toBe(403);
    expect((await inject("PATCH", `/api/returns/${opened.id}`, { status: "EN_DIAGNOSTICO", note: "En revisión técnica" }, auth)).statusCode).toBe(200);
    const resolved = await inject("POST", `/api/returns/${opened.id}/resolve`, { resolution: "REPARACION", settlement: "NINGUNO", amount: 0, destination: "PROVEEDOR" });
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect((await inject("POST", `/api/returns/${opened.id}/rma`, { status: "APROBADO", note: "Aprobó el proveedor" }, auth)).statusCode).toBe(403);
    const rma = await inject("POST", `/api/returns/${opened.id}/rma`, { status: "APROBADO", note: "Aprobó el proveedor" });
    expect(rma.statusCode, rma.body).toBe(200);
    expect(rma.json().return.events.at(-1)).toMatchObject({ status: "APROBADO", note: "Aprobó el proveedor" });
  });
});
