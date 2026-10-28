import { describe, expect, it } from "vitest";
import { claimsForDevices, deviceProblemLabel, indexProblems, summarizeProblems, type ProblemClaim } from "./problems.js";
import { readPurchaseName } from "./purchase-name.js";

const item = { id: "one", supplierId: "supplier", imei: "123", status: "DISPONIBLE" };
function claim(id: string, changes: Partial<ProblemClaim> = {}): ProblemClaim {
  return { id, inventoryItemId: "one", supplierId: "supplier", imei: "123", caseNumber: 1, deviceLabel: "iPhone", reason: "Batería", status: "RESUELTO", rmaStatus: null, openedAt: new Date(), clientName: "Ana", ...changes };
}

describe("equipos distintos con problemas", () => {
  it.each([
    ["EN_REVISION", false, false, null], ["EN_REVISION", true, false, "Reclamo"],
    ["EN_REVISION", false, true, "En servicio técnico"], ["EN_RMA", false, false, "En RMA"], ["EN_RMA", true, true, "En RMA"],
    ["VENDIDO", true, false, "Reclamo"], ["DISPONIBLE", false, true, "En servicio técnico"],
    ["DISPONIBLE", false, false, null],
  ])("%s", (status, claims, repair, expected) => expect(deviceProblemLabel(status as string, claims as boolean, repair as boolean)).toBe(expected));

  it("no cuenta revisión sin reclamo ni reparación y conserva el total de equipos", () => {
    const items = [{ ...item, status: "EN_REVISION" }, { ...item, id: "two", status: "EN_RMA" }];
    const problems = indexProblems(items, [], []);
    expect(problems.get("one")).toMatchObject({ problem: false, label: null });
    expect(summarizeProblems(items, problems)).toEqual({ problems: 1, devices: 2 });
  });

  it("deduplica reclamos por ambas claves y equipos con múltiples señales", () => {
    const items = [{ ...item, status: "EN_REVISION" }, { ...item, id: "two", imei: "456" }];
    const claims = [claim("a"), claim("b"), claim("c", { inventoryItemId: null, imei: "456" })];
    const problems = indexProblems(items, claims, [{ imei: "123" }, { imei: "456" }]);
    expect(summarizeProblems(items, problems)).toEqual({ problems: 2, devices: 2 });
    expect(claimsForDevices(items, problems)).toHaveLength(3);
    expect(problems.get("one")?.claims).toHaveLength(2);
  });

  it("permite la relación directa sin proveedor, y exige proveedor e IMEI para el enlace alternativo", () => {
    const claims = [claim("direct", { supplierId: null, imei: "" }), claim("other", { inventoryItemId: null, supplierId: "other" }), claim("blank", { inventoryItemId: null, imei: "" })];
    const result = indexProblems([item, { ...item, id: "two", supplierId: null, imei: "" }], claims, [{ imei: "" }]);
    expect(result.get("one")?.claims.map(row => row.id)).toEqual(["direct"]);
    expect(result.get("two")?.problem).toBe(false);
  });
});

describe("nombre de compra opcional", () => {
  it("recorta, acepta alias/null y conserva precedencia explícita", () => {
    expect(readPurchaseName({ name: "  Lote septiembre  " })).toBe("Lote septiembre");
    expect(readPurchaseName({ purchaseName: "Nombre", name: "Alias" })).toBe("Nombre");
    expect(readPurchaseName({ purchaseName: null, name: "Alias" })).toBeNull();
    expect(readPurchaseName({ name: "   " })).toBeNull();
    expect(readPurchaseName({})).toBeNull();
    expect(readPurchaseName({ name: "x".repeat(120) })).toHaveLength(120);
    expect(() => readPurchaseName({ name: "x".repeat(121) })).toThrow();
  });
});
