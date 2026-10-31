import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../plugins/prisma.js";
import type { ReturnPatternView } from "../modules/returns/patterns.service.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();
const ownerHeaders = buildAuthHeaders();

async function fixture() {
  const owner = await seedStoreContext();
  const storeId = owner.store!.id;
  const supplier = await prisma.supplier.create({ data: { storeId, name: "Importadora Andes" } });
  const otherSupplier = await prisma.supplier.create({ data: { storeId, name: "Tech Cuyo" } });
  const purchase = await prisma.stockPurchase.create({ data: { storeId, supplierId: supplier.id, name: "Septiembre", purchasedAt: new Date("2026-09-20T15:00:00Z"), notes: "Revisar baterías" } });
  const previous = await prisma.stockPurchase.create({ data: { storeId, supplierId: supplier.id, purchasedAt: new Date("2026-09-05T15:00:00Z") } });
  const otherPurchase = await prisma.stockPurchase.create({ data: { storeId, supplierId: otherSupplier.id, purchasedAt: new Date("2026-10-01T15:00:00Z") } });
  let serial = 0;
  const device = (data: Partial<Prisma.InventoryItemUncheckedCreateInput> = {}) => prisma.inventoryItem.create({ data: {
    storeId, model: "iPhone 15 Pro", capacity: "256GB", color: "Titanio", condition: "USADO", grade: "A", batteryHealth: "90%", cost: 100, price: 200,
    status: "DISPONIBLE", supplierId: supplier.id, stockPurchaseId: purchase.id, currency: "ARS", imei: `35000000000${String(++serial).padStart(4, "0")}`, ...data,
  } });
  const review = await device({ status: "EN_REVISION" });
  const fallback = await device();
  const rma = await device({ status: "EN_RMA" });
  const repair = await device();
  const healthy = await device({ status: "EN_REVISION" }); // Review alone is not a purchase problem.
  const old = await device({ stockPurchaseId: previous.id });
  const loose = await device({ stockPurchaseId: null });
  const noOrigin = await device({ supplierId: null, stockPurchaseId: null, model: "iPhone SE", capacity: "64GB" });
  const archived = await device({ archivedAt: new Date() });
  const another = await device({ supplierId: otherSupplier.id, stockPurchaseId: otherPurchase.id, capacity: "128GB" });
  const claim = (caseNumber: number, data: Partial<Prisma.ReturnCaseUncheckedCreateInput> = {}) => prisma.returnCase.create({ data: {
    storeId, caseNumber, inventoryItemId: review.id, supplierId: supplier.id, imei: review.imei!, deviceLabel: "iPhone 15 Pro · 256GB", reason: "Batería al 70%",
    clientName: "Julián", openedAt: new Date(`2026-10-${String(caseNumber).padStart(2, "0")}T15:00:00Z`), ...data,
  } });
  await claim(1, { status: "RESUELTO" }); // Resolved is still a live claim.
  await claim(2, { reason: "Pantalla rota" }); // Same device, different claim.
  await claim(3, { inventoryItemId: null, imei: fallback.imei!, reason: "BATERIA se agota" });
  await claim(4, { inventoryItemId: healthy.id, imei: healthy.imei!, deletedAt: new Date() });
  await claim(5, { inventoryItemId: healthy.id, imei: healthy.imei!, status: "ANULADO" }); // Legacy cancelled claim without deletedAt.
  await claim(6, { inventoryItemId: noOrigin.id, supplierId: null, imei: noOrigin.imei!, deviceLabel: "iPhone SE · 64GB", reason: "Cámara" });
  await prisma.repairOrder.createMany({ data: [
    { storeId, device: "iPhone", imei: review.imei!, fault: "Falla", status: "EN_REPARACION" },
    { storeId, device: "iPhone", imei: repair.imei!, fault: "Falla", status: "RECIBIDO" },
    { storeId, device: "iPhone", imei: healthy.imei!, fault: "Falla", status: "ENTREGADO" },
    { storeId, device: "iPhone", imei: healthy.imei!, fault: "Falla", status: "EN_REPARACION", archivedAt: new Date() },
  ] });
  const staff = await prisma.user.create({ data: { firebaseUid: "patterns-staff", email: "patterns-staff@example.com" } });
  const membership = await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: "STAFF", sections: ["inventory", "sales"], isDefault: true } });
  const staffHeaders = buildAuthHeaders({ uid: staff.firebaseUid, email: staff.email! });
  return { storeId, supplier, otherSupplier, purchase, previous, otherPurchase, review, fallback, rma, repair, healthy, old, loose, noOrigin, archived, another, staffHeaders, membership, device, claim };
}

describe("contratos backend proveedores/patrones #308", () => {
  it("cuenta equipos distintos y mantiene el contrato de historial con alternativa liviana", async () => {
    const f = await fixture();
    const app = getApp();
    const list = await app.inject({ method: "GET", url: "/api/suppliers", headers: ownerHeaders });
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().suppliers.find((row: { id: string }) => row.id === f.supplier.id)).toMatchObject({ deviceCount: 7, problemCount: 4, claimCount: 3, lastPurchasedAt: "2026-09-20" });
    const detail = await app.inject({ method: "GET", url: `/api/suppliers/${f.supplier.id}`, headers: ownerHeaders });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().supplier).toMatchObject({ deviceCount: 7, stockCount: 7, claimedDeviceCount: 2, costTotals: [{ currency: "ARS", totalCost: 700 }], problemCount: 4, claimCount: 3 });
    const purchases = detail.json().supplier.purchases;
    expect(purchases.map((row: { id: string }) => row.id)).toEqual([f.purchase.id, f.previous.id, "sin-lote"]);
    expect(purchases[0]).toMatchObject({ name: "Septiembre", purchasedAt: "2026-09-20", devices: 5, problemCount: 4, claimCount: 3, totalCost: 500, currency: "ARS" });
    expect(purchases[0].items).toHaveLength(5);
    expect(purchases[0].items.some((row: { id: string; problem: boolean }) => row.id === f.fallback.id && row.problem)).toBe(true);
    const light = await app.inject({ method: "GET", url: `/api/suppliers/${f.supplier.id}?includeItems=0`, headers: ownerHeaders });
    expect(light.json().supplier.purchases).toHaveLength(2);
    expect(light.json().supplier.purchases.every((row: object) => !("items" in row))).toBe(true);
    const history = await app.inject({ method: "GET", url: `/api/suppliers/${f.supplier.id}/purchases`, headers: ownerHeaders });
    expect(history.json().purchases).toEqual(light.json().supplier.purchases);
    await prisma.inventoryItem.update({ where: { id: f.old.id }, data: { status: "VENDIDO", currency: "USD", cost: 2 } });
    const summary = await app.inject({ method: "GET", url: `/api/suppliers/${f.supplier.id}?includeItems=0`, headers: ownerHeaders });
    expect(summary.json().supplier).toMatchObject({ deviceCount: 7, stockCount: 6, claimedDeviceCount: 2, costTotals: [{ currency: "ARS", totalCost: 600 }, { currency: "USD", totalCost: 2 }] });
  });

  it("detalle de compra aislado por proveedor/tienda y costos solo con canSeeFinancials", async () => {
    const f = await fixture();
    const app = getApp();
    const url = `/api/suppliers/${f.supplier.id}/purchases/${f.purchase.id}`;
    const owner = await app.inject({ method: "GET", url, headers: ownerHeaders });
    expect(owner.statusCode, owner.body).toBe(200);
    expect(owner.json().purchase).toMatchObject({ summary: { problems: 4, devices: 5 }, totalCost: 500, costTotals: [{ currency: "ARS", totalCost: 500 }] });
    const items = owner.json().purchase.items;
    expect(items.find((row: { id: string }) => row.id === f.rma.id)).toMatchObject({ problemLabel: "En RMA", cost: 100, color: "Titanio" });
    expect(items.find((row: { id: string }) => row.id === f.fallback.id)).toMatchObject({ problemLabel: "Reclamo" });
    expect(items.find((row: { id: string }) => row.id === f.repair.id)).toMatchObject({ problemLabel: "En servicio técnico" });
    expect(items.find((row: { id: string }) => row.id === f.healthy.id)).toMatchObject({ problem: false, problemLabel: null });
    for (const path of [url, `/api/suppliers/${f.supplier.id}`, `/api/suppliers/${f.supplier.id}/purchases`]) {
      const staff = await app.inject({ method: "GET", url: path, headers: f.staffHeaders });
      expect(staff.statusCode, staff.body).toBe(200);
      expect(staff.body).toMatch(/"(?:cost|totalCost|costTotals)":/);
    }
    await prisma.storeMember.update({ where: { id: f.membership.id }, data: { sections: ["inventory", "sales", "reports"] } });
    const authorizedStaff = await app.inject({ method: "GET", url, headers: f.staffHeaders });
    expect(authorizedStaff.json().purchase.totalCost).toBe(500);
    const wrongSupplier = await app.inject({ method: "GET", url: `/api/suppliers/${f.otherSupplier.id}/purchases/${f.purchase.id}`, headers: ownerHeaders });
    expect(wrongSupplier.statusCode).toBe(404);
    const other = await seedStoreContext({ firebaseUid: "patterns-other", email: "other@example.com" });
    const otherHeaders = buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email! });
    for (const path of [url, `/api/suppliers/${f.supplier.id}/purchases`, `/api/inventory/${f.review.id}`]) expect((await app.inject({ method: "GET", url: path, headers: otherHeaders })).statusCode).toBe(404);
    await prisma.stockPurchase.update({ where: { id: f.purchase.id }, data: { deletedAt: new Date() } });
    expect((await app.inject({ method: "GET", url, headers: ownerHeaders })).statusCode).toBe(404);
  });

  it("no suma monedas distintas en un total monetario engañoso", async () => {
    const f = await fixture();
    await prisma.inventoryItem.update({ where: { id: f.healthy.id }, data: { currency: "USD", cost: 2 } });
    const result = await getApp().inject({ method: "GET", url: `/api/suppliers/${f.supplier.id}/purchases/${f.purchase.id}`, headers: ownerHeaders });
    expect(result.json().purchase).toMatchObject({ totalCost: null, currency: null, costTotals: [{ currency: "ARS", totalCost: 400 }, { currency: "USD", totalCost: 2 }] });
  });

  it("patrones excluye archivados, separa modelo/capacidad y equipos sin origen; usa acceso de devoluciones", async () => {
    const f = await fixture();
    const app = getApp();
    const get = async (groupBy: string, headers = ownerHeaders) => app.inject({ method: "GET", url: `/api/returns/patterns?groupBy=${groupBy}`, headers });
    const purchases = await get("purchase");
    expect(purchases.statusCode, purchases.body).toBe(200);
    expect(purchases.json().summary).toMatchObject({ devices: 9, problems: 3, claims: 4, openClaims: 3, percent: 33, topReason: { family: "bateria", claims: 2 } });
    const rows: ReturnPatternView[] = purchases.json().patterns;
    expect(rows.map(row => row.key)).toHaveLength(4);
    expect(rows.find(row => row.key === "none")).toMatchObject({ label: "Sin compra asignada", supplierId: null, purchaseId: null, devices: 2, problems: 1, claims: 1 });
    const purchased = rows.find(row => row.key === f.purchase.id)!;
    expect(purchased).toMatchObject({ key: f.purchase.id, label: "Importadora Andes · Septiembre", supplierId: f.supplier.id, purchaseId: f.purchase.id, devices: 5, problems: 2, claims: 3, percent: 40, hot: true, topReason: { family: "bateria", label: "batería", claims: 2 }, claimsTruncated: false });
    expect(purchased.claimsDetail.map(claim => claim.caseNumber)).toEqual(["RMA-0003", "RMA-0002", "RMA-0001"]);
    expect(purchased.claimsDetail[0]).toMatchObject({ deviceLabel: "iPhone 15 Pro · 256GB", imei: f.fallback.imei, reason: "BATERIA se agota", status: "ABIERTO", openedAt: "2026-10-03T15:00:00.000Z", clientName: "Julián" });
    expect(rows.find(row => row.key === f.previous.id)?.label).toBe("Importadora Andes · 05/09/2026");
    expect(purchases.body).not.toMatch(/"(?:cost|totalCost|price|moneyAmount)":/);
    const suppliers = (await get("supplier")).json().patterns;
    expect(suppliers.find((row: ReturnPatternView) => row.key === "none")).toMatchObject({ label: "Sin proveedor asignado", supplierId: null, purchaseId: null, devices: 1, problems: 1, claims: 1 });
    expect(suppliers.find((row: ReturnPatternView) => row.key === f.supplier.id)).toMatchObject({ devices: 7, problems: 2, claims: 3, percent: 29 });
    const models: ReturnPatternView[] = (await get("model")).json().patterns;
    expect(models[0].label).toBe("iPhone SE · 64GB"); // 1/1 outranks 2/7.
    expect(models.find(row => row.label === "iPhone 15 Pro · 256GB")).toMatchObject({ devices: 7, problems: 2, claims: 3 });
    expect(models.find(row => row.label === "iPhone SE · 64GB")).toMatchObject({ devices: 1, problems: 1, claims: 1, topReason: { family: "camara", label: "cámara", claims: 1 }, supplierId: null, purchaseId: null });
    expect(models.find(row => row.label === "iPhone 15 Pro · 128GB")).toMatchObject({ devices: 1, problems: 0 });
    await prisma.storeMember.update({ where: { id: f.membership.id }, data: { sections: ["sales"] } });
    expect((await get("purchase", f.staffHeaders)).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/suppliers", headers: f.staffHeaders })).statusCode).toBe(403);
    await prisma.storeMember.update({ where: { id: f.membership.id }, data: { sections: ["inventory"] } });
    expect((await get("purchase", f.staffHeaders)).statusCode).toBe(403);
    expect((await get("wrong")).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/returns/patterns" })).statusCode).toBe(401);
    const other = await seedStoreContext({ firebaseUid: "pattern-isolated", email: "isolated@example.com" });
    expect((await get("model", buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email! }))).json().patterns).toEqual([]);
  });

  it("conserva 1 reclamo resuelto entre 268 equipos sin origen y mantiene los orígenes parciales", async () => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    await prisma.inventoryItem.createMany({ data: Array.from({ length: 268 }, (_, i) => ({
      id: `device-${i}`, storeId, model: "iPhone 14", capacity: "128GB", color: "Negro", condition: "USADO", grade: "A", batteryHealth: "90%", cost: 100, price: 200, currency: "USD", status: "DISPONIBLE",
    })) });
    await prisma.returnCase.create({ data: { storeId, caseNumber: 1, inventoryItemId: "device-0", openedAt: new Date("2026-10-24T15:00:00Z"), reason: "asd", status: "RESUELTO" } });
    const get = async (groupBy: string) => {
      const response = await getApp().inject({ method: "GET", url: `/api/returns/patterns?groupBy=${groupBy}`, headers: ownerHeaders });
      expect(response.statusCode, response.body).toBe(200);
      return response.json();
    };
    for (const [by, label] of [["supplier", "Sin proveedor asignado"], ["purchase", "Sin compra asignada"]]) {
      const response = await get(by);
      expect(response.summary).toMatchObject({ devices: 268, problems: 1, claims: 1, openClaims: 0, percent: 0, topReason: { label: "asd" } });
      expect(response.patterns).toHaveLength(1);
      expect(response.patterns[0]).toMatchObject({ key: "none", label, supplierId: null, purchaseId: null, devices: 268, problems: 1, claims: 1 });
      expect(response.patterns[0].claimsDetail).toHaveLength(1);
    }
    const supplier = await prisma.supplier.create({ data: { storeId, name: "Andes" } });
    await prisma.inventoryItem.update({ where: { id: "device-0" }, data: { supplierId: supplier.id } });
    expect((await get("purchase")).patterns.find((row: ReturnPatternView) => row.key === "none")).toMatchObject({ problems: 1, supplierId: null, purchaseId: null });
    const purchase = await prisma.stockPurchase.create({ data: { storeId, supplierId: supplier.id, name: "Octubre", purchasedAt: new Date("2026-10-01T15:00:00Z") } });
    await prisma.inventoryItem.update({ where: { id: "device-0" }, data: { stockPurchaseId: purchase.id } });
    expect((await get("purchase")).patterns.find((row: ReturnPatternView) => row.key === purchase.id)).toMatchObject({ label: "Andes · Octubre", supplierId: supplier.id, purchaseId: purchase.id, problems: 1 });
    await prisma.inventoryItem.update({ where: { id: "device-0" }, data: { supplierId: null } });
    expect((await get("purchase")).patterns.find((row: ReturnPatternView) => row.key === purchase.id)).toMatchObject({ label: "Octubre", supplierId: null, problems: 1 });
    await prisma.stockPurchase.update({ where: { id: purchase.id }, data: { deletedAt: new Date() } });
    expect((await get("purchase")).patterns).toEqual([expect.objectContaining({ key: "none", devices: 268, problems: 1, claims: 1 })]);
    for (const [index, status] of ["ABIERTO", "EN_DIAGNOSTICO", "EN_PROVEEDOR", "CERRADO", "ANULADO"].entries()) {
      await prisma.returnCase.create({ data: { storeId, caseNumber: index + 2, inventoryItemId: "device-0", openedAt: new Date("2026-10-24T15:00:00Z"), reason: "asd", status } });
    }
    expect((await get("model")).summary).toMatchObject({ devices: 268, problems: 1, claims: 5, openClaims: 3 });
  });

  it("acota el detalle a 50 sin truncar los contadores ni el motivo común", async () => {
    const f = await fixture();
    await prisma.returnCase.createMany({ data: Array.from({ length: 51 }, (_, index) => ({ storeId: f.storeId, caseNumber: 100 + index, inventoryItemId: f.fallback.id, supplierId: f.supplier.id, imei: f.fallback.imei!, reason: "Audio", openedAt: new Date() })) });
    const result = await getApp().inject({ method: "GET", url: "/api/returns/patterns?groupBy=purchase", headers: ownerHeaders });
    const pattern: ReturnPatternView = result.json().patterns.find((row: ReturnPatternView) => row.key === f.purchase.id);
    expect(pattern).toMatchObject({ devices: 5, problems: 2, claims: 54, claimsTruncated: true, topReason: { family: "audio", claims: 51 } });
    expect(pattern.claimsDetail).toHaveLength(50);
    expect(result.json().summary).toMatchObject({ devices: 9, problems: 3, claims: 55, openClaims: 54, percent: 33, topReason: { family: "audio", claims: 51 } });
  });

  it("inventario devuelve metadata en ambas listas y resumen sólo en detalle, con filtro seguro", async () => {
    const f = await fixture();
    const app = getApp();
    for (const suffix of ["", "?skip=0&take=100"]) {
      const result = await app.inject({ method: "GET", url: `/api/inventory${suffix}`, headers: ownerHeaders });
      expect(result.statusCode, result.body).toBe(200);
      const items = result.json().inventory ?? result.json().items;
      expect(items.find((item: { id: string }) => item.id === f.review.id)).toMatchObject({ stockPurchaseId: f.purchase.id, purchasedAt: "2026-09-20", purchaseName: "Septiembre", supplierName: "Importadora Andes" });
      expect(items.find((item: { id: string }) => item.id === f.noOrigin.id)).toMatchObject({ stockPurchaseId: null, purchasedAt: null, purchaseName: null, supplierId: null, supplierName: null });
      expect(items.every((item: object) => !("purchaseSummary" in item))).toBe(true);
    }
    const detail = await app.inject({ method: "GET", url: `/api/inventory/${f.review.id}`, headers: f.staffHeaders });
    expect(detail.json().inventoryItem).toMatchObject({ purchaseSummary: { problems: 4, devices: 5 }, purchasedAt: "2026-09-20", purchaseName: "Septiembre" });
    expect(detail.json().inventoryItem.cost).toBe(100);
    const loose = await app.inject({ method: "GET", url: `/api/inventory/${f.loose.id}`, headers: ownerHeaders });
    expect(loose.json().inventoryItem).toMatchObject({ purchaseSummary: null, stockPurchaseId: null, purchaseName: null, purchasedAt: null });
    for (const suffix of [`?supplierId=${f.otherSupplier.id}`, `?supplierId=${f.otherSupplier.id}&take=50`, `/ids?supplierId=${f.otherSupplier.id}`]) {
      const result = await app.inject({ method: "GET", url: `/api/inventory${suffix}`, headers: ownerHeaders });
      const body = result.json();
      expect(body.ids ?? (body.inventory ?? body.items).map((item: { id: string }) => item.id)).toEqual([f.another.id]);
      if (body.total !== undefined) expect(body.total).toBe(1);
    }
    expect((await app.inject({ method: "GET", url: `/api/inventory?take=5&supplierId=${encodeURIComponent("' OR 1=1 --")}`, headers: ownerHeaders })).json().items).toEqual([]);
  });

  it("alta/import aceptan nombre/alias opcional y rechazan >120 antes de persistir", async () => {
    const f = await fixture();
    const app = getApp();
    const payload = { model: "iPhone 14", capacity: "128GB", color: "Azul", condition: "USADO", grade: "A", batteryHealth: "90%", cost: 100, price: 200, status: "DISPONIBLE", supplierId: f.supplier.id };
    for (const extra of [{ purchaseName: "  Octubre  " }, { name: "  Alias  " }, {}, { purchaseName: "   " }]) {
      const result = await app.inject({ method: "POST", url: "/api/inventory", headers: ownerHeaders, payload: { ...payload, ...extra } });
      expect(result.statusCode, result.body).toBe(201);
      expect(result.json().inventoryItem.purchaseName).toBe("purchaseName" in extra ? extra.purchaseName?.trim() || null : "name" in extra ? extra.name?.trim() : null);
      expect(result.json().inventoryItem.purchasedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const count = await prisma.inventoryItem.count({ where: { storeId: f.storeId } });
    const bad = await app.inject({ method: "POST", url: "/api/inventory", headers: ownerHeaders, payload: { ...payload, purchaseName: "x".repeat(121) } });
    expect(bad.statusCode).toBe(400);
    expect(await prisma.inventoryItem.count({ where: { storeId: f.storeId } })).toBe(count);
    for (const extra of [{ name: "  Importado  " }, { purchaseName: "  Principal  ", name: "Alias" }]) {
      const imported = await app.inject({ method: "POST", url: "/api/inventory/import", headers: ownerHeaders, payload: { supplierId: f.supplier.id, ...extra, rows: [{ imei: "", model: "iPhone 11", price: 200, cost: 100 }] } });
      expect(imported.statusCode, imported.body).toBe(200);
      expect(imported.json().imported).toBe(1);
      expect(await prisma.stockPurchase.findFirst({ where: { storeId: f.storeId, name: "purchaseName" in extra ? "Principal" : "Importado" } })).toBeTruthy();
    }
    const badImport = await app.inject({ method: "POST", url: "/api/inventory/import", headers: ownerHeaders, payload: { supplierId: f.supplier.id, name: "x".repeat(121), rows: [{ imei: "", model: "iPhone 11", price: 200 }] } });
    expect(badImport.statusCode).toBe(400);
  });

  it("crear y leer reclamos hereda supplierId y devuelve supplierName", async () => {
    const f = await fixture();
    const sale = await prisma.sale.create({ data: { storeId: f.storeId, inventoryItemId: f.old.id, deviceLabel: "iPhone 15 Pro", dateLabel: "2026-10-01", amount: 200, amountCurrency: "ARS", paymentMethod: "EFECTIVO", status: "COMPLETADA", soldAt: new Date() } });
    const app = getApp();
    const created = await app.inject({ method: "POST", url: "/api/returns", headers: ownerHeaders, payload: { saleId: sale.id, reason: "No carga", openedOn: "2026-10-22" } });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json().return).toMatchObject({ supplierId: f.supplier.id, supplierName: "Importadora Andes", inventoryItemId: f.old.id });
    const result = await app.inject({ method: "GET", url: "/api/returns", headers: ownerHeaders });
    expect(result.json().returns.find((row: { id: string }) => row.id === created.json().return.id)).toMatchObject({ supplierId: f.supplier.id, supplierName: "Importadora Andes" });
  });
});
