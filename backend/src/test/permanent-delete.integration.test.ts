import { describe, expect, it, vi } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";
import { writeAudit } from "../modules/audit/audit.js";
import { permanentlyDelete } from "../modules/audit/permanent-delete.js";

vi.mock("../modules/audit/audit.js", async original => {
  const actual = await original<typeof import("../modules/audit/audit.js")>();
  return { ...actual, writeAudit: vi.fn(actual.writeAudit) };
});

const { getApp } = useIntegrationApp();
const entities = [
  ["inventory", "inventory"], ["sales", "sale"], ["clients", "client"],
  ["trade-ins", "trade"], ["repairs", "repair"],
] as const;
type Entity = typeof entities[number][0];
const archivedAt = new Date("2026-11-04T12:00:00Z");

async function fixture(entity: Entity, storeId: string, inactive: boolean) {
  const archive = inactive ? { archivedAt } : {};
  const voided = inactive ? { voidedAt: archivedAt } : {};
  switch (entity) {
    case "inventory": return prisma.inventoryItem.create({ data: {
      storeId, model: "iPhone 13", capacity: "128GB", color: "Negro", condition: "USADO",
      grade: "A", batteryHealth: "90%", cost: 100, price: 200, status: "DISPONIBLE", ...archive,
    } });
    case "clients": return prisma.client.create({ data: { storeId, name: "Cliente ficticio", dni: "30123456", ...archive } });
    case "sales": return prisma.sale.create({ data: {
      storeId, clientName: "Cliente ficticio", deviceLabel: "iPhone 13", dateLabel: "04/11/2026", soldAt: archivedAt,
      amount: 200, paymentMethod: "EFECTIVO", status: "COMPLETADA", ...voided,
    } });
    case "trade-ins": return prisma.tradeIn.create({ data: {
      storeId, clientName: "Cliente ficticio", deviceReceived: "iPhone 12", dateLabel: "04/11/2026", tradeAt: archivedAt,
      takeValue: 100, differencePaid: 100, status: "LISTO", ...voided,
    } });
    case "repairs": return prisma.repairOrder.create({ data: { storeId, device: "iPhone 13", fault: "Pantalla", ...archive } });
  }
}

async function exists(entity: Entity, id: string) {
  const where = { id };
  switch (entity) {
    case "inventory": return prisma.inventoryItem.findUnique({ where });
    case "clients": return prisma.client.findUnique({ where });
    case "sales": return prisma.sale.findUnique({ where });
    case "trade-ins": return prisma.tradeIn.findUnique({ where });
    case "repairs": return prisma.repairOrder.findUnique({ where });
  }
}

async function member(storeId: string, role: "STAFF" | "MANAGER", sensitiveAccess?: boolean) {
  const user = await prisma.user.create({ data: { firebaseUid: `fixture-${role}`, email: `${role}@example.com` } });
  await prisma.storeMember.create({ data: {
    userId: user.id, storeId, role, isDefault: true, sensitiveAccess,
    sections: ["inventory", "sales", "clients", "tradeins", "service"],
  } });
  return buildAuthHeaders({ uid: user.firebaseUid, email: user.email! });
}

describe.each(entities)("permanent DELETE %s", (entity, entityType) => {
  it("preserves existing reversible deletion for staff with sensitive access", async () => {
    const { store } = await seedStoreContext();
    const row = await fixture(entity, store!.id, false);
    const response = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}`, headers: await member(store!.id, "STAFF", true) });
    expect(response.statusCode, response.body).toBe(204);
    const retained = await exists(entity, row.id);
    expect(retained).toBeTruthy();
    if (entity === "sales" || entity === "trade-ins") expect(retained).toMatchObject({ voidedAt: expect.any(Date) });
    else expect(retained).toMatchObject({ archivedAt: expect.any(Date) });
    expect(await prisma.auditEvent.count({ where: { action: `${entityType}.permanently_deleted` } })).toBe(0);
  });

  it.each([false, true])("rejects STAFF with sensitiveAccess=%s and leaves the record and audit untouched", async sensitive => {
    const { store } = await seedStoreContext();
    const row = await fixture(entity, store!.id, true);
    const response = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: await member(store!.id, "STAFF", sensitive) });
    expect(response.statusCode).toBe(403);
    expect(await exists(entity, row.id)).toBeTruthy();
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("rejects MANAGER even with sensitive access", async () => {
    const { store } = await seedStoreContext();
    const row = await fixture(entity, store!.id, true);
    const response = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: await member(store!.id, "MANAGER", true) });
    expect(response.statusCode).toBe(403);
    expect(await exists(entity, row.id)).toBeTruthy();
  });

  it("rejects an active record for OWNER with 409", async () => {
    const { store } = await seedStoreContext();
    const row = await fixture(entity, store!.id, false);
    const response = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: buildAuthHeaders() });
    expect(response.statusCode).toBe(409);
    expect(await exists(entity, row.id)).toBeTruthy();
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("allows OWNER after logical deletion and retains an identifiable audit after physical deletion", async () => {
    const { store, user } = await seedStoreContext();
    const row = await fixture(entity, store!.id, true);
    const previous = await prisma.auditEvent.create({ data: { storeId: store!.id, actorName: "Empleado", action: `${entityType}.created`, entityType, entityId: row.id } });
    const response = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: buildAuthHeaders() });
    expect(response.statusCode, response.body).toBe(204);
    expect(await exists(entity, row.id)).toBeNull();
    expect(await prisma.auditEvent.findUnique({ where: { id: previous.id } })).toBeTruthy();
    expect(await prisma.auditEvent.findFirst({ where: { storeId: store!.id, entityId: row.id, action: `${entityType}.permanently_deleted` } })).toMatchObject({
      actorUserId: user.id, actorRole: "OWNER", actorName: "Test Owner", entityType, entityLabel: expect.stringMatching(/iPhone|Cliente|V-/),
    });
    const history = await getApp().inject({ method: "GET", url: `/api/history?entityType=${entityType}&entityId=${row.id}`, headers: buildAuthHeaders() });
    expect(history.statusCode).toBe(200);
    expect(history.body).toContain("Borró definitivamente");
    expect(history.body).toContain('"recordState":"gone"');
    const repeated = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: buildAuthHeaders() });
    expect(repeated.statusCode).toBe(404);
  });

  it("returns 404 for another store and 401 without authentication", async () => {
    await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: "other", email: "other@example.com" });
    const row = await fixture(entity, other.store!.id, true);
    const url = `/api/${entity}/${row.id}/permanent`;
    expect((await getApp().inject({ method: "DELETE", url, headers: buildAuthHeaders() })).statusCode).toBe(404);
    expect((await getApp().inject({ method: "DELETE", url })).statusCode).toBe(401);
    expect(await exists(entity, row.id)).toBeTruthy();
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("rolls back physical deletion when audit persistence fails", async () => {
    const { store } = await seedStoreContext();
    const row = await fixture(entity, store!.id, true);
    vi.mocked(writeAudit).mockRejectedValueOnce(new Error("Synthetic audit failure"));
    const response = await getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: buildAuthHeaders() });
    expect(response.statusCode).toBe(500);
    expect(await exists(entity, row.id)).toBeTruthy();
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("serializes simultaneous deletes and writes exactly one audit", async () => {
    const { store } = await seedStoreContext();
    const row = await fixture(entity, store!.id, true);
    const responses = await Promise.all([1, 2].map(() => getApp().inject({ method: "DELETE", url: `/api/${entity}/${row.id}/permanent`, headers: buildAuthHeaders() })));
    expect(responses.map(res => res.statusCode).sort()).toEqual([204, 404]);
    expect(await prisma.auditEvent.count({ where: { action: `${entityType}.permanently_deleted` } })).toBe(1);
  });
});

describe("permanent delete compatibility and effects", () => {
  it.each(["CANCELADA", "ANULADA", "CANCELADO", " cancelled "])("accepts historical sale state %s without voidedAt", async status => {
    const { store } = await seedStoreContext();
    const row = await fixture("sales", store!.id, false);
    await prisma.sale.update({ where: { id: row.id }, data: { status } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/sales/${row.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
  });

  it.each(["CANCELLED", "ANULADO", "CANCELADO"])("accepts cancelled trade %s without voidedAt", async status => {
    const { store } = await seedStoreContext();
    const row = await fixture("trade-ins", store!.id, false);
    await prisma.tradeIn.update({ where: { id: row.id }, data: status === "CANCELLED" ? { confirmationStatus: status } : { status } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/trade-ins/${row.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
  });

  it("revalidates current ownership rather than trusting an actor role", async () => {
    const { store, user, membership } = await seedStoreContext();
    const row = await fixture("clients", store!.id, true);
    await prisma.storeMember.update({ where: { id: membership!.id }, data: { role: "STAFF", sensitiveAccess: true } });
    await expect(permanentlyDelete(store!.id, "clients", row.id, { userId: user.id, name: "Former owner", role: "OWNER" })).rejects.toMatchObject({ statusCode: 403 });
    expect(await exists("clients", row.id)).toBeTruthy();
  });

  it("does not reapply sale cancellation or delete the linked client, trade or equipment", async () => {
    const { store } = await seedStoreContext();
    const client = await fixture("clients", store!.id, false);
    const item = await fixture("inventory", store!.id, false);
    const trade = await fixture("trade-ins", store!.id, true);
    const sale = await fixture("sales", store!.id, true);
    await prisma.client.update({ where: { id: client.id }, data: { totalSpent: 400, pendingBalance: 100 } });
    await prisma.sale.update({ where: { id: sale.id }, data: { clientId: client.id, inventoryItemId: item.id, tradeInId: trade.id } });
    await prisma.saleTender.create({ data: { storeId: store!.id, saleId: sale.id, amount: 200, method: "EFECTIVO", currency: "ARS" } });
    const before = await exists("clients", client.id);
    const stock = await exists("inventory", item.id);
    expect((await getApp().inject({ method: "DELETE", url: `/api/sales/${sale.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
    expect(await exists("clients", client.id)).toEqual(before);
    expect(await exists("inventory", item.id)).toEqual(stock);
    expect(await exists("trade-ins", trade.id)).toBeTruthy();
    expect(await prisma.saleTender.count()).toBe(0);
    expect(await prisma.cashMovement.count()).toBe(0);
  });

  it("deletes a client's dependent deposits and payments while retaining other business records", async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    const client = await fixture("clients", storeId, true);
    const sale = await fixture("sales", storeId, false);
    const trade = await fixture("trade-ins", storeId, false);
    const repair = await fixture("repairs", storeId, false);
    await prisma.sale.update({ where: { id: sale.id }, data: { clientId: client.id } });
    await prisma.tradeIn.update({ where: { id: trade.id }, data: { clientId: client.id } });
    await prisma.repairOrder.update({ where: { id: repair.id }, data: { clientId: client.id } });
    await prisma.clientPayment.create({ data: { storeId, clientId: client.id, amount: 50, method: "EFECTIVO", saleId: sale.id } });
    await prisma.clientDeposit.create({ data: { storeId, clientId: client.id, requestKey: "fixture-deposit", amount: 50, currency: "ARS", exchangeRate: 1000, usdAmount: 0.05, method: "EFECTIVO", status: "REFUNDED" } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/clients/${client.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
    expect(await exists("clients", client.id)).toBeNull();
    expect(await prisma.clientDeposit.count()).toBe(0);
    expect(await prisma.clientPayment.count()).toBe(0);
    for (const [entity, id] of [["sales", sale.id], ["trade-ins", trade.id], ["repairs", repair.id]] as const) {
      expect(await exists(entity, id)).toMatchObject({ clientId: null });
    }
  });

  it("keeps a repair's payments and client while deleting status events", async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    const client = await fixture("clients", storeId, false);
    const order = await fixture("repairs", storeId, true);
    await prisma.repairOrder.update({ where: { id: order.id }, data: { clientId: client.id } });
    await prisma.repairStatusEvent.create({ data: { storeId, orderId: order.id, status: "RECIBIDO" } });
    const payment = await prisma.clientPayment.create({ data: { storeId, clientId: client.id, repairOrderId: order.id, amount: 50, method: "EFECTIVO" } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/repairs/${order.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
    expect(await prisma.repairStatusEvent.count()).toBe(0);
    expect(await prisma.clientPayment.findUnique({ where: { id: payment.id } })).toMatchObject({ repairOrderId: null, clientId: client.id });
    expect(await exists("clients", client.id)).toBeTruthy();
  });

  it("rolls back a client's dependent deposits if the audit cannot be written", async () => {
    const { store } = await seedStoreContext();
    const client = await fixture("clients", store!.id, true);
    const deposit = await prisma.clientDeposit.create({ data: { storeId: store!.id, clientId: client.id, requestKey: "fixture-rollback", amount: 50, currency: "ARS", exchangeRate: 1000, usdAmount: 0.05, method: "EFECTIVO", status: "REFUNDED" } });
    vi.mocked(writeAudit).mockRejectedValueOnce(new Error("Synthetic audit failure"));
    expect((await getApp().inject({ method: "DELETE", url: `/api/clients/${client.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(500);
    expect(await exists("clients", client.id)).toBeTruthy();
    expect(await prisma.clientDeposit.findUnique({ where: { id: deposit.id } })).toBeTruthy();
  });

  it("detaches a permanently deleted trade without deleting its sale or received equipment", async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    const item = await fixture("inventory", storeId, true);
    const trade = await fixture("trade-ins", storeId, true);
    const sale = await fixture("sales", storeId, true);
    await prisma.tradeIn.update({ where: { id: trade.id }, data: { receivedInventoryItemId: item.id } });
    await prisma.sale.update({ where: { id: sale.id }, data: { tradeInId: trade.id } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/trade-ins/${trade.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
    expect(await exists("sales", sale.id)).toMatchObject({ tradeInId: null });
    expect(await exists("inventory", item.id)).toBeTruthy();
  });

  it("detaches permanently deleted equipment without deleting sales or received trades", async () => {
    const { store } = await seedStoreContext();
    const storeId = store!.id;
    const item = await fixture("inventory", storeId, true);
    const trade = await fixture("trade-ins", storeId, true);
    const sale = await fixture("sales", storeId, true);
    await prisma.tradeIn.update({ where: { id: trade.id }, data: { receivedInventoryItemId: item.id } });
    await prisma.sale.update({ where: { id: sale.id }, data: { inventoryItemId: item.id } });
    expect((await getApp().inject({ method: "DELETE", url: `/api/inventory/${item.id}/permanent`, headers: buildAuthHeaders() })).statusCode).toBe(204);
    expect(await exists("sales", sale.id)).toMatchObject({ inventoryItemId: null });
    expect(await exists("trade-ins", trade.id)).toMatchObject({ receivedInventoryItemId: null });
  });
});
