import { describe, expect, it } from "vitest";
import { decideClientLink, decideInventoryLink, matchOpenTradeIn, matchSellerUserId } from "./link-imported-sale.js";
import { normalizeImportedPhone, normalizeImportDate, normalizePayment } from "./normalize-import.js";

describe("imported phone, date and payment", () => {
  it("turns Argentine numbers with and without +54 into the same WhatsApp form", () => {
    const canonical = "+5491155551234";
    expect(normalizeImportedPhone("11 5555-1234")).toBe(canonical);
    expect(normalizeImportedPhone("+54 9 11 5555-1234")).toBe(canonical);
    expect(normalizeImportedPhone("+54 11 5555-1234")).toBe(canonical);
    expect(normalizeImportedPhone("011 15 5555-1234")).toBe(canonical);
    expect(normalizeImportedPhone("5491155551234")).toBe(canonical);
    expect(normalizeImportedPhone("0261 15 444-5566")).toBe("+5492614445566");
    expect(normalizeImportedPhone("15 11 6666-7788")).toBe("+5491166667788");
  });

  it("normalizes mixed sale dates and payment labels", () => {
    expect(normalizeImportDate("7/10/26")).toBe("07/10/2026");
    expect(normalizeImportDate("2026-10-03")).toBe("03/10/2026");
    expect(normalizeImportDate("3-oct-2026")).toBe("03/10/2026");
    expect(normalizePayment("Mercado Pago")).toBe("TRANSFERENCIA");
    expect(normalizePayment("débito")).toBe("TARJETA");
    expect(normalizePayment("T. Crédito")).toBe("T. Crédito");
  });
});

describe("linking imported sales", () => {
  const clients = [
    { id: "ana", name: "Ana Gómez", dni: "30.111.222", phone: "11 5555-1234", email: "ana@gmail.com" },
    { id: "ana-2", name: "Ana Gómez", dni: null, phone: null, email: null },
  ];

  it("matches DNI before a repeated name and does not invent a second client", () => {
    expect(decideClientLink(clients, { name: "Otra", dni: "30111222" })).toEqual({ action: "use", clientId: "ana" });
    expect(decideClientLink(clients, { name: "Ana Gómez" })).toEqual({ action: "ambiguous" });
    expect(decideClientLink([{ id: "only", name: "Luis Paz" }], { name: "luis paz" })).toEqual({ action: "use", clientId: "only" });
    expect(decideClientLink(clients, { name: "Nueva Persona" })).toEqual({ action: "create" });
  });

  it("links disponible stock and leaves sold, archived or missing items alone", () => {
    expect(decideInventoryLink({ id: "item", status: "DISPONIBLE", archivedAt: null }, false)).toEqual({ action: "link", inventoryItemId: "item" });
    expect(decideInventoryLink({ id: "item", status: "VENDIDO", archivedAt: null }, false)).toEqual({ action: "leave" });
    expect(decideInventoryLink({ id: "item", status: "DISPONIBLE", archivedAt: null }, true)).toEqual({ action: "leave" });
    expect(decideInventoryLink({ id: "item", status: "DISPONIBLE", archivedAt: new Date() }, false)).toEqual({ action: "leave" });
    expect(decideInventoryLink(null, false)).toEqual({ action: "leave" });
  });

  it("links one open trade-in and one seller, and skips ties", () => {
    expect(matchOpenTradeIn([{ id: "t1", deviceReceived: "iPhone 11 64 GB" }], "iphone 11 64 gb")).toBe("t1");
    expect(matchOpenTradeIn([
      { id: "t1", deviceReceived: "iPhone 11" },
      { id: "t2", deviceReceived: "iPhone 11" },
    ], "iPhone 11")).toBeNull();
    expect(matchSellerUserId([{ userId: "u1", displayName: "Luis Paz" }], "luis paz")).toBe("u1");
    expect(matchSellerUserId([
      { userId: "u1", displayName: "Luis" },
      { userId: "u2", displayName: "Luis" },
    ], "Luis")).toBeNull();
  });
});
