import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

describe("repair orders", () => {
  const ctx = useIntegrationApp();

  it("creates an order in Recibido, keeps the status history and builds a WhatsApp link", async () => {
    const app = ctx.getApp();
    const owner = await seedStoreContext({ displayName: "Dueño Ejemplo" });
    const other = await seedStoreContext({ firebaseUid: "other-owner", email: "other@example.com", displayName: "Otra", role: "OWNER" });
    const staffUser = await seedStoreContext({
      firebaseUid: "test-staff",
      email: "staff@example.com",
      displayName: "Empleado",
      createStore: false,
    });
    await prisma.storeMember.create({
      data: { storeId: owner.store!.id, userId: staffUser.user.id, role: "STAFF", sections: ["sales"], isDefault: true },
    });
    const ownerHeaders = { "content-type": "application/json", ...buildAuthHeaders({ uid: owner.user.firebaseUid, email: owner.user.email ?? undefined, name: "Dueño Ejemplo" }) };
    const staffHeaders = { "content-type": "application/json", ...buildAuthHeaders({ uid: "test-staff", email: "staff@example.com", name: "Empleado" }) };
    const otherHeaders = { "content-type": "application/json", ...buildAuthHeaders({ uid: other.user.firebaseUid, email: other.user.email ?? undefined, name: "Otra" }) };

    const blocked = await app.inject({ method: "GET", url: "/api/repairs", headers: staffHeaders });
    expect(blocked.statusCode).toBe(403);

    const created = await app.inject({
      method: "POST",
      url: "/api/repairs",
      headers: ownerHeaders,
      payload: {
        clientName: "Cliente Ejemplo C",
        device: "iPhone 14",
        imei: "350000000000095",
        fault: "Cámara trasera borrosa",
        faultTags: ["Cámara"],
        estimate: 120000,
        deposit: 20000,
        technician: "Técnico Ejemplo",
        estimatedDelivery: "06/10/2026",
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.order.status).toBe("RECIBIDO");
    expect(body.order.notifyWhatsapp).toBe(true);
    expect(body.order.code).toMatch(/^OT-/);
    expect(body.order.events).toEqual([expect.objectContaining({ status: "RECIBIDO" })]);
    expect(body.order.whatsappUrl).toBeNull();
    expect(body.client.name).toBe("Cliente Ejemplo C");
    const orderId = body.order.id as string;

    await prisma.client.update({ where: { id: body.client.id }, data: { phone: "2614000000" } });

    const listed = await app.inject({ method: "GET", url: "/api/repairs", headers: ownerHeaders });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().orders).toHaveLength(1);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/repairs/${orderId}`,
      headers: ownerHeaders,
      payload: { technician: "Otro técnico" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().order.technician).toBe("Otro técnico");
    expect(patched.json().order.events).toHaveLength(1);

    const moved = await app.inject({
      method: "POST",
      url: `/api/repairs/${orderId}/status`,
      headers: ownerHeaders,
      payload: { status: "LISTO_PARA_RETIRAR" },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().order.status).toBe("LISTO_PARA_RETIRAR");
    expect(moved.json().order.events.map((event: { status: string }) => event.status)).toEqual(["RECIBIDO", "LISTO_PARA_RETIRAR"]);
    expect(moved.json().order.whatsappUrl).toContain("https://wa.me/5492614000000?text=");

    const hidden = await app.inject({ method: "GET", url: `/api/repairs/${orderId}`, headers: otherHeaders });
    expect(hidden.statusCode).toBe(404);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/repairs/${orderId}`,
      headers: buildAuthHeaders({ uid: owner.user.firebaseUid, email: owner.user.email ?? undefined, name: "Dueño Ejemplo" }),
    });
    expect(removed.statusCode).toBe(204);
    expect(await prisma.repairOrder.count({ where: { storeId: owner.store!.id } })).toBe(0);
    expect(await prisma.repairStatusEvent.count({ where: { storeId: owner.store!.id } })).toBe(0);
  });

  it("numbers orders per store, keeps delete and budget changes for sensitive members and answers 400 in Spanish", async () => {
    const app = ctx.getApp();
    const owner = await seedStoreContext({ firebaseUid: "rep-owner", email: "rep-owner@example.com", displayName: "Dueña" });
    const other = await seedStoreContext({ firebaseUid: "rep-other", email: "rep-other@example.com", displayName: "Otra" });
    const storeId = owner.store!.id;
    const staff = await prisma.user.create({ data: { firebaseUid: "rep-staff", email: "rep-staff@example.com", displayName: "Eva" } });
    await prisma.storeMember.create({ data: { storeId, userId: staff.id, role: "STAFF", sections: ["service"], isDefault: true } });
    const auth = (uid: string) => ({ "content-type": "application/json", ...buildAuthHeaders({ uid, email: `${uid}@example.com`, name: uid }) });
    const payload = { clientName: "Cliente", device: "iPhone 12", fault: "Pantalla", estimate: 1000 };

    const a1 = await app.inject({ method: "POST", url: "/api/repairs", headers: auth("rep-owner"), payload });
    const b1 = await app.inject({ method: "POST", url: "/api/repairs", headers: auth("rep-other"), payload });
    const a2 = await app.inject({ method: "POST", url: "/api/repairs", headers: auth("rep-staff"), payload });
    expect([a1.statusCode, b1.statusCode, a2.statusCode]).toEqual([201, 201, 201]);
    expect(a1.json().order.code).toBe("OT-0001");
    expect(b1.json().order.code).toBe("OT-0001");
    expect(a2.json().order.code).toBe("OT-0002");
    expect((await prisma.storeCounter.findUniqueOrThrow({ where: { storeId } })).lastRepairNumber).toBe(2);
    expect((await prisma.storeCounter.findUniqueOrThrow({ where: { storeId: other.store!.id } })).lastRepairNumber).toBe(1);
    const orderId = a2.json().order.id as string;

    const staffBudget = await app.inject({ method: "PATCH", url: `/api/repairs/${orderId}`, headers: auth("rep-staff"), payload: { estimate: 2000 } });
    expect(staffBudget.statusCode).toBe(403);
    expect(staffBudget.json().error).toBe("No tenés permiso para esta acción");
    const staffDeposit = await app.inject({ method: "PATCH", url: `/api/repairs/${orderId}`, headers: auth("rep-staff"), payload: { deposit: 50 } });
    expect(staffDeposit.statusCode).toBe(403);
    expect(staffDeposit.json().error).toBe("No tenés permiso para esta acción");
    const staffSameBudget = await app.inject({ method: "PATCH", url: `/api/repairs/${orderId}`, headers: auth("rep-staff"), payload: { estimate: 1000, technician: "Técnico" } });
    expect(staffSameBudget.statusCode).toBe(200);
    const staffMove = await app.inject({ method: "POST", url: `/api/repairs/${orderId}/status`, headers: auth("rep-staff"), payload: { status: "EN_REPARACION" } });
    expect(staffMove.statusCode).toBe(200);
    const staffDelete = await app.inject({ method: "DELETE", url: `/api/repairs/${orderId}`, headers: buildAuthHeaders({ uid: "rep-staff", email: "rep-staff@example.com", name: "Eva" }) });
    expect(staffDelete.statusCode).toBe(403);

    const ownerBudget = await app.inject({ method: "PATCH", url: `/api/repairs/${orderId}`, headers: auth("rep-owner"), payload: { estimate: 2500, deposit: 500 } });
    expect(ownerBudget.statusCode).toBe(200);
    expect(ownerBudget.json().order.estimate).toBe(2500);
    expect(ownerBudget.json().order.deposit).toBe(500);
    const ownerDelete = await app.inject({ method: "DELETE", url: `/api/repairs/${orderId}`, headers: buildAuthHeaders({ uid: "rep-owner", email: "rep-owner@example.com", name: "Dueña" }) });
    expect(ownerDelete.statusCode).toBe(204);
    const audit = await prisma.auditEvent.findMany({ where: { storeId, entityType: "repair" }, orderBy: { createdAt: "asc" } });
    expect(audit.map((event) => event.action)).toEqual(["repair.estimate", "repair.deleted"]);
    expect(audit[1]?.detail).toBe("OT-0002 · iPhone 12");

    const next = await app.inject({ method: "POST", url: "/api/repairs", headers: auth("rep-owner"), payload });
    expect(next.json().order.code).toBe("OT-0003");

    const invalid = await app.inject({ method: "POST", url: "/api/repairs", headers: auth("rep-owner"), payload: { clientName: "Cliente", device: "", deposit: -5 } });
    expect(invalid.statusCode).toBe(400);
    const body = invalid.json();
    expect(body.error).toBe("Completá el equipo");
    expect(body.fields).toMatchObject({ device: "Completá el equipo", deposit: "La seña no puede ser negativa" });
  });

  it("moves existing diagnóstico and waiting orders to Recibido and keeps their history", async () => {
    const app = ctx.getApp();
    const owner = await seedStoreContext({ firebaseUid: "retire-owner", email: "retire-owner@example.com", displayName: "Dueña" });
    const storeId = owner.store!.id;
    const headers = { "content-type": "application/json", ...buildAuthHeaders({ uid: "retire-owner", email: "retire-owner@example.com", name: "Dueña" }) };
    const payload = { clientName: "Cliente", device: "iPhone 13", fault: "Pantalla" };

    const seeded = await app.inject({ method: "GET", url: "/api/catalogs", headers });
    expect(seeded.statusCode).toBe(200);
    const repairOptions = seeded.json().options.filter((option: { kind: string }) => option.kind === "REPAIR_STATUS");
    expect(repairOptions.map((option: { value: string }) => option.value)).toEqual([
      "RECIBIDO", "EN_REPARACION", "LISTO_PARA_RETIRAR", "ENTREGADO",
    ]);

    await prisma.storeCatalogOption.createMany({
      data: [
        { storeId, kind: "REPAIR_STATUS", value: "EN_DIAGNOSTICO", label: "En diagnóstico", color: "#8B5CF6", sortOrder: 1 },
        { storeId, kind: "REPAIR_STATUS", value: "ESPERANDO_REPUESTO", label: "Esperando repuesto", color: "#E8A33D", sortOrder: 2 },
        { storeId, kind: "REPAIR_STATUS", value: "RESPUESTA_CLIENTE", label: "Esperando respuesta", color: "#E8A33D", sortOrder: 8 },
        { storeId, kind: "REPAIR_STATUS", value: "GARANTIA", label: "Garantía", color: "#3B82F6", sortOrder: 9 },
      ],
    });
    await prisma.storeCatalogOption.updateMany({
      where: { storeId, kind: "REPAIR_STATUS", value: "EN_REPARACION" },
      data: { label: "En diagnóstico" },
    });

    const created: Array<{ id: string; status: string }> = [];
    for (const status of ["EN_DIAGNOSTICO", "ESPERANDO_REPUESTO", "RESPUESTA_CLIENTE", "GARANTIA"]) {
      const response = await app.inject({ method: "POST", url: "/api/repairs", headers, payload });
      expect(response.statusCode).toBe(201);
      const id = response.json().order.id as string;
      await prisma.repairOrder.update({ where: { id }, data: { status } });
      await prisma.repairStatusEvent.create({ data: { storeId, orderId: id, status } });
      created.push({ id, status });
    }

    const listed = await app.inject({ method: "GET", url: "/api/repairs", headers });
    expect(listed.statusCode).toBe(200);
    const orders = listed.json().orders as Array<{ id: string; status: string; events: Array<{ status: string }> }>;
    const byId = new Map(orders.map((order) => [order.id, order]));
    for (const item of created.slice(0, 3)) {
      const order = byId.get(item.id);
      expect(order?.status).toBe("RECIBIDO");
      expect(order?.events.map((event) => event.status)).toEqual(["RECIBIDO", item.status, "RECIBIDO"]);
    }
    expect(byId.get(created[3]!.id)?.status).toBe("GARANTIA");
    expect(byId.get(created[3]!.id)?.events.map((event) => event.status)).toEqual(["RECIBIDO", "GARANTIA"]);

    const catalogs = await app.inject({ method: "GET", url: "/api/catalogs", headers });
    const values = catalogs.json().options
      .filter((option: { kind: string }) => option.kind === "REPAIR_STATUS")
      .map((option: { value: string; label: string }) => `${option.value}:${option.label}`);
    expect(values).toContain("EN_REPARACION:En diagnóstico");
    expect(values).toContain("GARANTIA:Garantía");
    expect(values.some((item: string) => item.startsWith("EN_DIAGNOSTICO:"))).toBe(false);
    expect(values.join(" ")).not.toContain("ESPERANDO_REPUESTO");
    expect(values.join(" ")).not.toContain("RESPUESTA_CLIENTE");
    expect(values.join(" ")).not.toContain("Esperando repuesto");
    expect(values.join(" ")).not.toContain("Esperando respuesta");

    const again = await app.inject({ method: "GET", url: "/api/repairs", headers });
    const replay = again.json().orders as Array<{ id: string; events: unknown[] }>;
    expect(replay.find((order) => order.id === created[0]!.id)?.events).toHaveLength(3);

    const rejected = await app.inject({ method: "POST", url: `/api/repairs/${created[3]!.id}/status`, headers, payload: { status: "EN_DIAGNOSTICO" } });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().error).toBe("Ese estado ya no está en el flujo");
    const blockedCreate = await app.inject({ method: "POST", url: "/api/repairs", headers, payload: { ...payload, status: "ESPERANDO_RESPUESTA" } });
    expect(blockedCreate.statusCode).toBe(400);
    expect(blockedCreate.json().error).toBe("Ese estado ya no está en el flujo");
  });
});
