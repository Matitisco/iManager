import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { blindLeak } from "../modules/stock-counts/classify.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

async function device(storeId: string, input: { imei?: string | null; model: string; status: string; price?: number }) {
  return prisma.inventoryItem.create({
    data: {
      storeId,
      imei: input.imei ?? null,
      model: input.model,
      capacity: "128GB",
      color: "Negro",
      condition: "USADO",
      grade: "A",
      batteryHealth: "90%",
      cost: 100,
      price: input.price ?? 500000,
      currency: "ARS",
      status: input.status,
    },
  });
}

describe("blind stock count", () => {
  it("snapshots the count, keeps the scan blind, and adjusts only what the owner chooses", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "count-owner", email: "count-owner@example.com", displayName: "Matías Tiscornia" });
    const storeId = owner.store!.id;
    const headers = buildAuthHeaders({ uid: "count-owner", email: "count-owner@example.com", name: "Matías Tiscornia" });
    const staff = await prisma.user.create({ data: { firebaseUid: "count-staff", email: "count-staff@example.com", displayName: "Tomás Rey" } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: "STAFF", isDefault: true, sections: ["inventory"] } });
    const staffHeaders = buildAuthHeaders({ uid: "count-staff", email: "count-staff@example.com", name: "Tomás Rey" });
    const partner = await prisma.user.create({ data: { firebaseUid: "count-partner", email: "count-partner@example.com", displayName: "Lucía Paz" } });
    await prisma.storeMember.create({ data: { storeId, userId: partner.id, role: "MANAGER", isDefault: true, sections: ["inventory"] } });
    const partnerHeaders = buildAuthHeaders({ uid: "count-partner", email: "count-partner@example.com", name: "Lucía Paz" });
    const salesOnly = await prisma.user.create({ data: { firebaseUid: "count-sales", email: "count-sales@example.com", displayName: "Iván" } });
    await prisma.storeMember.create({ data: { storeId, userId: salesOnly.id, role: "MANAGER", isDefault: true, sections: ["sales"] } });
    const salesHeaders = buildAuthHeaders({ uid: "count-sales", email: "count-sales@example.com", name: "Iván" });

    const found = await device(storeId, { imei: "352098117744521", model: "iPhone 13", status: "DISPONIBLE", price: 850000 });
    const missing = await device(storeId, { imei: "352098117741188", model: "iPhone 13 mini", status: "DISPONIBLE", price: 560000 });
    const soldLater = await device(storeId, { imei: "352098117746612", model: "iPhone 11", status: "DISPONIBLE", price: 330000 });
    const alreadySold = await device(storeId, { imei: "352098117745521", model: "iPhone XR", status: "VENDIDO", price: 240000 });
    await device(storeId, { imei: null, model: "Sin chip", status: "DISPONIBLE" });
    const review = await device(storeId, { imei: "352098117742207", model: "iPhone 14", status: "EN_REVISION" });

    const reserved = await device(storeId, { imei: "352098117740001", model: "Reservado", status: "RESERVADO" });
    await device(storeId, { model: "Reservado sin IMEI", status: "RESERVADO" });
    await device(storeId, { model: "En revisión sin IMEI", status: "EN_REVISION" });
    const archivedExcluded = await device(storeId, { model: "Archivado", status: "DISPONIBLE" });
    await prisma.inventoryItem.update({ where: { id: archivedExcluded.id }, data: { archivedAt: new Date() } });

    const preview = await app.inject({ method: "GET", url: "/api/stock-counts/preview", headers });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({
      excludedNoImei: 1,
      scope: "Disponible",
      counters: "Todo el equipo con Inventario",
    });
    expect(preview.body).not.toContain("iPhone");
    expect(preview.body).not.toContain("352098117744521");

    expect((await app.inject({ method: "POST", url: "/api/stock-counts", headers: staffHeaders })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/stock-counts/preview", headers: staffHeaders })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/stock-counts", headers: salesHeaders })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: "/api/stock-counts", headers: salesHeaders })).statusCode).toBe(403);

    const started = await app.inject({ method: "POST", url: "/api/stock-counts", headers });
    expect(started.statusCode).toBe(201);
    const countId = started.json().count.id as string;
    expect(blindLeak(started.json())).toBeNull();
    expect(started.body).not.toContain(missing.model);
    expect(started.body).not.toContain("excludedNoImei");
    expect(started.json().count.total).toBe(0);

    const snapshot = await prisma.stockCountExpected.findMany({ where: { stockCountId: countId } });
    expect(snapshot.map((row) => row.inventoryItemId).sort()).toEqual([found.id, missing.id, soldLater.id].sort());
    expect(snapshot.map((row) => row.inventoryItemId)).not.toContain(alreadySold.id);
    expect(snapshot.map((row) => row.inventoryItemId)).not.toContain(reserved.id);
    expect(snapshot.map((row) => row.inventoryItemId)).not.toContain(review.id);
    expect(snapshot.every((row) => row.statusAtSnapshot === "DISPONIBLE")).toBe(true);

    const again = await app.inject({ method: "POST", url: "/api/stock-counts", headers: partnerHeaders });
    expect(again.statusCode).toBe(409);

    const first = await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/scans`, headers: staffHeaders, payload: { imei: "35 209 811 774 4521" } });
    expect(first.statusCode).toBe(200);
    expect(first.json().count.scans[0]).toMatchObject({ result: "FOUND", model: "iPhone 13", imei: "352098117744521" });
    expect(first.json().count.mine).toBe(1);
    expect(first.json().count.total).toBe(1);
    expect(blindLeak(first.json())).toBeNull();
    expect(first.body).not.toContain(missing.model);
    expect(first.body).not.toContain(soldLater.model);

    const repeat = await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/scans`, headers: partnerHeaders, payload: { imei: "352098117744521" } });
    expect(repeat.json().count.scans[0].result).toBe("REPEATED");
    expect(repeat.json().count.mine).toBe(0);
    expect(repeat.json().count.total).toBe(1);
    expect(repeat.json().count.scans).toHaveLength(1);
    expect(repeat.body).not.toContain("iPhone 13 mini");

    const unknown = await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/scans`, headers: staffHeaders, payload: { imei: "352098117747702" } });
    expect(unknown.json().count.scans[0]).toMatchObject({ result: "NOT_LOADED", imei: "352098117747702" });
    const soldScan = await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/scans`, headers: staffHeaders, payload: { imei: alreadySold.imei } });
    expect(soldScan.json().count.scans[0]).toMatchObject({ result: "SOLD", model: "iPhone XR" });
    expect(soldScan.json().count.total).toBe(3);
    expect(soldScan.json().count.mine).toBe(3);

    await prisma.inventoryItem.update({ where: { id: soldLater.id }, data: { status: "VENDIDO" } });
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/close`, headers: staffHeaders })).statusCode).toBe(403);

    const closed = await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/close`, headers });
    expect(closed.statusCode).toBe(200);
    const buckets = closed.json().count.buckets;
    expect(buckets.matched.map((row: { inventoryItemId: string }) => row.inventoryItemId)).toEqual([found.id]);
    expect(buckets.missing.map((row: { inventoryItemId: string }) => row.inventoryItemId).sort()).toEqual([missing.id].sort());
    expect(buckets.sold.map((row: { imei: string; note: string | null }) => ({ imei: row.imei, note: row.note }))).toEqual([
      { imei: soldLater.imei, note: "Se vendió durante el conteo" },
      { imei: alreadySold.imei, note: "Figura vendido" },
    ]);
    expect(buckets.surplus.map((row: { imei: string }) => row.imei)).toEqual(["352098117747702"]);
    expect(closed.json().count.excludedNoImei).toBe(1);
    expect(closed.json().count.summary).toContain("1 coinciden");
    expect(closed.json().count.summary).toContain("1 sin escanear");

    const touchedSold = await app.inject({
      method: "POST",
      url: `/api/stock-counts/${countId}/resolve`,
      headers,
      payload: { mode: "ADJUST", missingIds: [soldLater.id], surplusImeis: [] },
    });
    expect(touchedSold.statusCode).toBe(400);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: soldLater.id } })).archivedAt).toBeNull();

    const adjusted = await app.inject({
      method: "POST",
      url: `/api/stock-counts/${countId}/resolve`,
      headers,
      payload: { mode: "ADJUST", missingIds: [missing.id], surplusImeis: ["352098117747702"] },
    });
    expect(adjusted.statusCode).toBe(200);
    expect(adjusted.json().count.resolution).toBe("ADJUSTED");
    const archived = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: missing.id } });
    expect(archived.archiveReason).toBe("Faltante");
    expect(archived.archivedAt).not.toBeNull();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: review.id } })).archivedAt).toBeNull();
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: alreadySold.id } })).status).toBe("VENDIDO");
    const loaded = await prisma.inventoryItem.findFirstOrThrow({ where: { storeId, imei: "352098117747702" } });
    expect(loaded.needsCompletion).toBe(true);
    expect(loaded.status).toBe("DISPONIBLE");

    const events = await prisma.auditEvent.findMany({ where: { storeId, entityType: "stockcount" }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => event.action)).toEqual(["stockcount.opened", "stockcount.closed", "stockcount.adjusted"]);
    expect(events[0].detail).toMatch(/abrió un control de stock a las \d{2}:\d{2}\./);
    expect(events[1].detail).toContain("Contaron Tomás y Lucía");
    expect(events[1].detail).toMatch(/a las \d{2}:\d{2}/);
    expect(events[2].detail).toContain("archivó 1 faltante con el motivo Faltante");
    expect(events[2].detail).toContain("cargó 1 sobrante");
    const history = await app.inject({ method: "GET", url: "/api/history?section=inventory", headers });
    const sentences = history.json().events.map((event: { actorName: string; verb: string }) => `${event.actorName} ${event.verb}`);
    expect(sentences.some((sentence: string) => /Matías Tiscornia abrió un control de stock a las \d{2}:\d{2}\./.test(sentence))).toBe(true);
  });

  it("records a count without changing stock and hides it from another store", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: "record-owner", email: "record-owner@example.com", displayName: "Natan" });
    const other = await seedStoreContext({ firebaseUid: "record-other", email: "record-other@example.com", displayName: "Otra tienda" });
    const headers = buildAuthHeaders({ uid: "record-owner", email: "record-owner@example.com", name: "Natan" });
    const otherHeaders = buildAuthHeaders({ uid: "record-other", email: "record-other@example.com", name: "Otra tienda" });
    const item = await device(owner.store!.id, { imei: "359000000000001", model: "iPhone 12", status: "DISPONIBLE" });
    const started = await app.inject({ method: "POST", url: "/api/stock-counts", headers });
    const countId = started.json().count.id as string;
    expect((await app.inject({ method: "GET", url: `/api/stock-counts/${countId}`, headers: otherHeaders })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/scans`, headers: otherHeaders, payload: { imei: item.imei } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/stock-counts", headers: otherHeaders })).json().counts).toEqual([]);

    const closed = await app.inject({ method: "POST", url: `/api/stock-counts/${countId}/close`, headers });
    expect(closed.json().count.buckets.missing).toHaveLength(1);
    const recorded = await app.inject({
      method: "POST",
      url: `/api/stock-counts/${countId}/resolve`,
      headers,
      payload: { mode: "RECORD", missingIds: [item.id], surplusImeis: ["359000000000099"] },
    });
    expect(recorded.statusCode).toBe(200);
    expect(recorded.json().count.resolution).toBe("RECORDED");
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).archivedAt).toBeNull();
    expect(await prisma.inventoryItem.findFirst({ where: { storeId: owner.store!.id, imei: "359000000000099" } })).toBeNull();
    const detail = await prisma.auditEvent.findFirstOrThrow({ where: { storeId: owner.store!.id, action: "stockcount.recorded" } });
    expect(detail.detail).toMatch(/dejó registrado el control de stock a las \d{2}:\d{2}, sin cambiar el inventario\./);

    const openAgain = await app.inject({ method: "GET", url: `/api/stock-counts/${countId}`, headers });
    expect(openAgain.json().count.buckets.missing[0].model).toBe("iPhone 12");
    const listed = await app.inject({ method: "GET", url: "/api/stock-counts", headers });
    expect(listed.json().counts[0].summary).toContain("1 sin escanear");
    expect(listed.json().counts[0].summary).not.toContain("iPhone");
  });
});
