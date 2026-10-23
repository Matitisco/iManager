import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { createRepair, changeRepairStatus } from "../modules/repairs/repairs.service.js";
import { listHistory, type HistoryEvent } from "../modules/audit/history.service.js";
import { seedStoreContext, buildAuthHeaders } from "./db.js";
import { repairHistoryRows } from "../modules/audit/repair-history.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("repair record history", () => {
  it("exposes receipt, every transition and delivery once with the original actor through the modal endpoint", async () => {
    const owner = await seedStoreContext({ displayName: "Ana" });
    const storeId = owner.store!.id;
    const actor = { userId: owner.user.id, name: "Ana", role: "OWNER" };
    const { order } = await createRepair(storeId, { device: "iPhone 13", fault: "Pantalla" }, actor);
    for (const status of ["EN_REPARACION", "LISTO_PARA_RETIRAR", "ENTREGADO", "ENTREGADO"]) {
      await changeRepairStatus(storeId, order.id, status, actor);
    }
    const response = await getApp().inject({
      method: "GET", url: `/api/history?entityType=repair&entityId=${order.id}&limit=50`,
      headers: buildAuthHeaders(),
    });
    expect(response.statusCode).toBe(200);
    const { events, nextCursor } = response.json<{ events: HistoryEvent[]; nextCursor: string | null }>();
    expect(events).toHaveLength(4);
    expect(nextCursor).toBeNull();
    expect(events.map(event => event.changes[0].after)).toEqual(["ENTREGADO", "LISTO_PARA_RETIRAR", "EN_REPARACION", "RECIBIDO"]);
    expect(events.every(event => event.actorName === "Ana" && event.actorUserId === owner.user.id && event.recordState === "active")).toBe(true);
    expect(events.map(event => event.action)).toEqual(["repair.status", "repair.status", "repair.status", "repair.created"]);
    expect(events.some(event => event.id.startsWith("repair-event:"))).toBe(false);
  });

  it("merges older states with audits, paginates tied dates and filters without crossing stores or orders", async () => {
    const owner = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: "other", email: "other@example.com" });
    const storeId = owner.store!.id;
    const date = new Date("2026-10-20T15:00:00.000Z");
    const order = await prisma.repairOrder.create({ data: { storeId, orderNumber: 12345, device: "iPhone antiguo", status: "ENTREGADO" } });
    const foreign = await prisma.repairOrder.create({ data: { storeId: other.store!.id, device: "Ajeno" } });
    const sibling = await prisma.repairOrder.create({ data: { storeId, device: "Otra orden" } });
    await prisma.repairStatusEvent.createMany({ data: [
      { id: "old-1", storeId, orderId: order.id, status: "RECIBIDO", createdAt: date },
      { id: "old-2", storeId, orderId: order.id, status: "EN_DIAGNOSTICO", createdAt: date },
      { id: "old-3", storeId, orderId: order.id, status: "EN_REPARACION", createdAt: date },
      { id: "old-4", storeId, orderId: order.id, status: "ENTREGADO", createdAt: date },
      { storeId: other.store!.id, orderId: foreign.id, status: "AJENO", createdAt: date },
      { storeId, orderId: sibling.id, status: "OTRA_ORDEN", createdAt: date },
    ] });
    await prisma.auditEvent.createMany({ data: [
      { id: "audit-created", storeId, entityType: "repair", entityId: order.id, action: "repair.created", actorName: "Ana", createdAt: date },
      { id: "audit-delivered", storeId, entityType: "repair", entityId: order.id, action: "repair.status", actorName: "Ana", actorUserId: owner.user.id, createdAt: date,
        changes: [{ field: "status", label: "Estado", before: "EN_REPARACION", after: "ENTREGADO" }] },
    ] });
    const query = { entityType: "repair", entityId: order.id, limit: 1 };
    const events: HistoryEvent[] = [];
    let cursor: string | undefined;
    do {
      const page = await listHistory(storeId, { ...query, cursor });
      events.push(...page.events);
      cursor = page.nextCursor ?? undefined;
      expect(events.length).toBeLessThanOrEqual(4);
    } while (cursor);
    expect(events.map(event => event.id)).toEqual(["repair-event:old-3", "repair-event:old-2", "audit-delivered", "audit-created"]);
    expect(events[0]).toMatchObject({ actorName: "Sin autor registrado", actorUserId: null, legacy: false });
    expect(events[0].changes).toEqual([{ field: "status", label: "Estado", before: "EN_DIAGNOSTICO", after: "EN_REPARACION" }]);
    expect((await listHistory(other.store!.id, query)).events).toEqual([]);
    expect((await listHistory(storeId, { ...query, limit: 50, actorUserId: owner.user.id })).events.map(event => event.id)).toEqual(["audit-delivered"]);
    expect((await listHistory(storeId, { ...query, limit: 50, group: "Alta" })).events.map(event => event.id)).toEqual(["audit-created"]);
    expect((await listHistory(storeId, { ...query, limit: 50, group: "Cambio de estado" })).events).toHaveLength(3);
    expect((await listHistory(storeId, { ...query, section: "sales" })).events).toEqual([]);
    expect((await listHistory(storeId, { ...query, q: "EN_DIAGNOSTICO", limit: 50 })).events).toHaveLength(2);
    expect((await listHistory(storeId, { ...query, q: "OT-12345", limit: 50 })).events).toHaveLength(2);
    expect((await listHistory(storeId, { ...query, from: new Date("2026-10-21") })).events).toEqual([]);
    expect((await listHistory(storeId, { ...query, to: new Date("2026-10-19") })).events).toEqual([]);
  });

  it("keeps the initial status without an actor, and exposes an unaudited old receipt", async () => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const { order } = await createRepair(storeId, { device: "Sistema", fault: "Pantalla" });
    const query = { entityType: "repair", entityId: order.id };
    const current = await listHistory(storeId, query);
    expect(current.events).toHaveLength(1);
    expect(current.events[0]).toMatchObject({ actorName: "Sistema", action: "repair.created", source: "system" });
    await prisma.auditEvent.deleteMany({ where: { storeId, entityId: order.id } });
    const old = await listHistory(storeId, query);
    expect(old.events).toHaveLength(1);
    expect(old.events[0]).toMatchObject({ actorName: "Sin autor registrado", action: "repair.created" });
    expect(old.events[0].changes).toEqual([{ field: "status", label: "Estado", before: null, after: "RECIBIDO" }]);
  });

  it.each(["UTC", "America/Argentina/Buenos_Aires"])("keeps cursor and date boundaries in UTC when the connection uses %s", async zone => {
    const owner = await seedStoreContext();
    const storeId = owner.store!.id;
    const order = await prisma.repairOrder.create({ data: { storeId, device: "Zona horaria" } });
    const at = new Date("2026-10-20T15:00:00.000Z");
    await prisma.repairStatusEvent.createMany({ data: ["RECIBIDO", "EN_REPARACION", "ENTREGADO"].map((status, index) => ({
      id: `timezone-${index + 1}`, storeId, orderId: order.id, status, createdAt: at,
    })) });
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('TimeZone', ${zone}, true)`;
      const query = { entityType: "repair", entityId: order.id };
      const afterCursor = await repairHistoryRows(storeId, query, null, { createdAt: at, id: "repair-event:timezone-3" }, 50, tx);
      expect(afterCursor.map(event => event.id)).toEqual(["repair-event:timezone-2", "repair-event:timezone-1"]);
      expect(await repairHistoryRows(storeId, { ...query, from: new Date(at.getTime() + 1) }, null, null, 50, tx)).toEqual([]);
      expect(await repairHistoryRows(storeId, { ...query, to: new Date(at.getTime() - 1) }, null, null, 50, tx)).toEqual([]);
      expect(await repairHistoryRows(storeId, { ...query, from: at, to: at }, null, null, 50, tx)).toHaveLength(3);
    });
  });

});
