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
        notifyWhatsapp: true,
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.order.status).toBe("RECIBIDO");
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
});
