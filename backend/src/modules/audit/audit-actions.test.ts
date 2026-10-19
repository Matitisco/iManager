import { describe, expect, it } from "vitest";
import { describeAudit } from "./audit-actions.js";

describe("describeAudit", () => {
  it("keeps a seller change as a short sentence with the sale code", () => {
    const event = describeAudit({ action: "sale.seller.changed", entityLabel: "V-0190 · iPhone 13" });
    expect(`${event.verb} ${event.target}`.trim()).toBe("cambió el vendedor de V-0190");
  });

  it("uses a neutral sale when the seller change has no code", () => {
    const event = describeAudit({
      action: "sale.seller.changed",
      detail: "11111111-1111-1111-1111-111111111111 → 22222222-2222-2222-2222-222222222222",
    });
    expect(`${event.verb} ${event.target}`.trim()).toBe("cambió el vendedor de la venta");
  });

  it("names a legacy delete when the object is known", () => {
    expect(describeAudit({ action: "sale.deleted", entityLabel: "V-0004" })).toMatchObject({
      verb: "eliminó",
      target: "V-0004 (antes del historial)",
      legacy: true,
    });
  });

  it("uses neutral wording for a legacy delete without an object", () => {
    expect(describeAudit({ action: "inventory.deleted", detail: "borrado viejo" })).toMatchObject({
      verb: "eliminó",
      target: "un registro (antes del historial)",
    });
  });

  it("names a cash opening, with the register when it is known", () => {
    expect(`${describeAudit({ action: "cash.opened" }).verb} ${describeAudit({ action: "cash.opened" }).target}`.trim()).toBe("abrió una caja");
    expect(`${describeAudit({ action: "cash.opened", entityLabel: "Caja pesos" }).verb} ${describeAudit({ action: "cash.opened", entityLabel: "Caja pesos" }).target}`.trim()).toBe("abrió Caja pesos");
  });

  it("does not leave a bare update", () => {
    const event = describeAudit({ action: "widget.updated" });
    expect(`${event.verb} ${event.target}`.trim()).toBe("actualizó un registro");
    expect(`${describeAudit({ action: "catalog.settings" }).verb} ${describeAudit({ action: "catalog.settings" }).target}`.trim()).toBe("actualizó el catálogo");
  });

  it("describes catalog visibility from the stored detail", () => {
    const event = describeAudit({ action: "catalog.visibility", detail: "Ocultar: 1 equipo" });
    expect(`${event.verb} ${event.target}`.trim()).toBe("cambió la visibilidad de 1 equipo");
  });

  it("keeps a sale registration that already names the document", () => {
    expect(describeAudit({ action: "sale.created" }).target).toBe("");
    expect(describeAudit({ action: "sale.created", entityLabel: "V-0012 · iPhone 13" }).target).toBe("V-0012 · iPhone 13");
  });
});
