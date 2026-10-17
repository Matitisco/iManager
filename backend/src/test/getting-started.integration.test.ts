import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";
const { getApp } = useIntegrationApp();
const headers = (uid: string) => buildAuthHeaders({ uid });

describe("primeros pasos persistentes y muestras", () => {
  it("conserva tiendas existentes sin activar el recorrido y recuerda descarte/video por miembro", async () => {
    const ctx = await seedStoreContext();
    const app = getApp();
    const get = () =>
      app.inject({
        method: "GET",
        url: "/api/onboarding/progress",
        headers: headers(ctx.user.firebaseUid),
      });
    expect((await get()).json()).toMatchObject({
      eligible: false,
      active: false,
      stock: 0,
    });
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/onboarding/progress",
      headers: headers(ctx.user.firebaseUid),
      payload: { dismissed: true, visible: true, installed: true },
    });
    expect(patch.json()).toMatchObject({
      dismissed: true,
      visible: true,
      installed: true,
      eligible: false,
    });
    expect(patch.json().videoWatched).toBeUndefined();
    expect((await get()).json().dismissed).toBe(true);
    const sample = await app.inject({
      method: "POST",
      url: "/api/onboarding/samples",
      headers: headers(ctx.user.firebaseUid),
    });
    expect(sample.statusCode).toBe(409);
  });
  it("crea por nombre, reanuda etapas y persiste los pendientes sin reabrir el recorrido", async () => {
    const ctx = await seedStoreContext({ createStore: false });
    const app = getApp();
    const auth = headers(ctx.user.firebaseUid);
    const created = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      headers: auth,
      payload: { storeName: "Nueva tienda" },
    });
    expect(created.json().session.store).toMatchObject({
      currency: "USD",
      exchangeSource: "blue",
      onboardingStage: "invite",
      instagram: null,
    });
    for (const stage of ["invite", "stock"]) {
      const next = await app.inject({
        method: "PATCH",
        url: "/api/onboarding/progress",
        headers: auth,
        payload: { stage },
      });
      expect(next.json()).toMatchObject({ active: true, stage });
    }
    expect(
      (
        await app.inject({ method: "GET", url: "/api/me", headers: auth })
      ).json().store.onboardingStage,
    ).toBe("stock");
    await app.inject({
      method: "PATCH",
      url: "/api/onboarding/progress",
      headers: auth,
      payload: { complete: true },
    });
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/onboarding/progress",
          headers: auth,
        })
      ).json(),
    ).toMatchObject({ active: false, eligible: true });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/onboarding/samples",
          headers: auth,
        })
      ).statusCode,
    ).toBe(200);
  });
  it("borra solo muestras propias, incluso con equipos reales y marcas falsas en customFields", async () => {
    const ctx = await seedStoreContext();
    const other = await seedStoreContext({ firebaseUid: "other" });
    await prisma.store.updateMany({
      where: { id: { in: [ctx.store!.id, other.store!.id] } },
      data: { onboardingStartedAt: new Date() },
    });
    const app = getApp();
    for (const uid of [ctx.user.firebaseUid, other.user.firebaseUid])
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/onboarding/samples",
            headers: headers(uid),
          })
        ).statusCode,
      ).toBe(200);
    const real = await prisma.inventoryItem.create({
      data: {
        storeId: ctx.store!.id,
        model: "Real",
        capacity: "",
        color: "",
        condition: "USADO",
        grade: "",
        batteryHealth: "",
        price: 123,
        cost: 0,
        status: "DISPONIBLE",
        customFields: { sampleBatchId: "fake" },
      },
    });
    const before = await app.inject({
      method: "GET",
      url: "/api/onboarding/progress",
      headers: headers(ctx.user.firebaseUid),
    });
    expect(before.json()).toMatchObject({ samples: 3, stock: 1 });
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/onboarding/samples",
          headers: headers(ctx.user.firebaseUid),
        })
      ).json(),
    ).toEqual({ count: 3 });
    expect(
      await prisma.inventoryItem.findUnique({ where: { id: real.id } }),
    ).not.toBeNull();
    expect(
      await prisma.inventoryItem.count({ where: { storeId: other.store!.id } }),
    ).toBe(3);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/onboarding/samples",
          headers: headers(ctx.user.firebaseUid),
        })
      ).json(),
    ).toEqual({ count: 0 });
  });
  it("respeta permisos, obtiene equipo real y no completa al generar una invitación", async () => {
    const ctx = await seedStoreContext();
    const staff = await seedStoreContext({
      firebaseUid: "staff",
      role: "STAFF",
    });
    await prisma.storeMember.update({
      where: { id: staff.membership!.id },
      data: { storeId: ctx.store!.id, sections: ["sales"] },
    });
    const app = getApp();
    for (const method of ["POST", "DELETE"] as const)
      expect(
        (
          await app.inject({
            method,
            url: "/api/onboarding/samples",
            headers: headers(staff.user.firebaseUid),
          })
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/onboarding/progress",
          headers: headers(staff.user.firebaseUid),
          payload: { stage: "stock" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/onboarding/progress",
          headers: headers(ctx.user.firebaseUid),
        })
      ).json().team,
    ).toBe(true);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/onboarding/progress",
          headers: headers(staff.user.firebaseUid),
        })
      ).json(),
    ).toMatchObject({ team: false, stock: 0, samples: 0 });
    expect(
      (await app.inject({ method: "GET", url: "/api/onboarding/progress" }))
        .statusCode,
    ).toBe(401);
  });

  it("completa tienda al alta, stock con un equipo, venta, invitación o segundo miembro, e instalación", async () => {
    const ctx = await seedStoreContext({ createStore: false });
    const app = getApp();
    const auth = headers(ctx.user.firebaseUid);
    await app.inject({
      method: "POST",
      url: "/api/onboarding",
      headers: auth,
      payload: { storeName: "iPhone Club Palermo" },
    });
    const fresh = await app.inject({ method: "GET", url: "/api/onboarding/progress", headers: auth });
    expect(fresh.json().steps).toEqual({
      store: true,
      stock: false,
      sale: false,
      team: false,
      install: false,
    });
    const storeId = (await prisma.storeMember.findFirstOrThrow({ where: { userId: ctx.user.id } })).storeId;
    await prisma.inventoryItem.create({
      data: {
        storeId,
        model: "iPhone 14",
        capacity: "128GB",
        color: "",
        condition: "USADO",
        grade: "",
        batteryHealth: "",
        price: 100,
        cost: 0,
        status: "DISPONIBLE",
      },
    });
    expect((await app.inject({ method: "GET", url: "/api/onboarding/progress", headers: auth })).json().steps.stock).toBe(true);
    await prisma.sale.create({
      data: {
        storeId,
        clientName: "Lucía",
        dateLabel: "17/10/2026",
        amount: 742000,
        amountCurrency: "ARS",
        paymentMethod: "EFECTIVO",
        status: "COMPLETADA",
        soldAt: new Date(),
      },
    });
    expect((await app.inject({ method: "GET", url: "/api/onboarding/progress", headers: auth })).json().steps.sale).toBe(true);
    const invite = await app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: auth,
      payload: { role: "STAFF", email: "martin@gmail.com", sections: ["sales", "inventory", "tradeins"], sensitiveAccess: false },
    });
    expect(invite.statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/api/onboarding/progress", headers: auth })).json().steps.team).toBe(true);
    const installed = await app.inject({
      method: "PATCH",
      url: "/api/onboarding/progress",
      headers: auth,
      payload: { installed: true },
    });
    expect(installed.json().steps).toMatchObject({ store: true, stock: true, sale: true, team: true, install: true });

    const seller = await seedStoreContext({ firebaseUid: "seller-386", role: "STAFF", createStore: false });
    await prisma.storeMember.create({
      data: { storeId, userId: seller.user.id, role: "STAFF", isDefault: true, sections: ["dashboard", "sales"] },
    });
    const hidden = await app.inject({
      method: "GET",
      url: "/api/onboarding/progress",
      headers: headers(seller.user.firebaseUid),
    });
    expect(hidden.json().steps).toEqual({
      store: false,
      stock: false,
      sale: false,
      team: false,
      install: false,
    });
  });
});
