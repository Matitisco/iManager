import { describe, expect, it } from "vitest";
import { blindLeak, classifyClose, classifyScan, isCountableStatus, normalizeImei } from "./classify.js";
import { adjustedClause, clockIn, closedClause, openedClause, recordedClause } from "./copy.js";
import { describeAudit } from "../audit/audit-actions.js";

const zone = "America/Argentina/Buenos_Aires";
const at = new Date("2026-10-19T14:10:00.000Z");

function device(id: string, imei: string, status = "DISPONIBLE") {
  return {
    inventoryItemId: id,
    imei,
    model: `Modelo ${id}`,
    capacity: "128GB",
    color: "Negro",
    statusAtSnapshot: status,
    price: 1000,
    currency: "ARS",
  };
}

describe("stock count classification", () => {
  it("keeps only 15 digit IMEIs and the countable statuses", () => {
    expect(normalizeImei("35 209 811 774 4521")).toBe("352098117744521");
    expect(normalizeImei("123")).toBe("");
    expect(isCountableStatus("En revisión")).toBe(true);
    expect(isCountableStatus("RESERVADO")).toBe(true);
    expect(isCountableStatus("VENDIDO")).toBe(false);
  });

  it("marks a repeated IMEI without adding it, and a device sold during the count is not missing", () => {
    const expected = [device("a", "111111111111111"), device("b", "222222222222222"), device("c", "333333333333333")];
    const repeated = classifyScan({ alreadyCounted: true, snapshot: expected[0], live: null });
    expect(repeated).toMatchObject({ result: "REPEATED", counts: false });
    expect(classifyScan({
      alreadyCounted: false,
      snapshot: null,
      live: { id: "d", status: "VENDIDO", model: "Vendido", capacity: "64GB", color: "Rojo", archivedAt: null },
    }).result).toBe("SOLD");
    expect(classifyScan({ alreadyCounted: false, snapshot: null, live: null }).result).toBe("NOT_LOADED");

    const result = classifyClose({
      expected,
      excludedNoImei: 3,
      live: [
        { id: "a", status: "DISPONIBLE" },
        { id: "b", status: "DISPONIBLE" },
        { id: "c", status: "VENDIDO" },
      ],
      scans: [
        { imei: "111111111111111", result: "FOUND", counts: true, inventoryItemId: "a", model: "Modelo a", capacity: "128GB", color: "Negro", scannedByName: "Lucía" },
        { imei: "111111111111111", result: "REPEATED", counts: false, inventoryItemId: "a", model: "Modelo a", capacity: "128GB", color: "Negro", scannedByName: "Tomás" },
        { imei: "444444444444444", result: "NOT_LOADED", counts: true, inventoryItemId: null, model: null, capacity: null, color: null, scannedByName: "Tomás" },
        { imei: "555555555555555", result: "SOLD", counts: true, inventoryItemId: "d", model: "Vendido", capacity: "64GB", color: "Rojo", scannedByName: "Lucía" },
      ],
    });

    expect(result.scanCount).toBe(3);
    expect(result.matched.map((row) => row.imei)).toEqual(["111111111111111"]);
    expect(result.missing.map((row) => row.imei)).toEqual(["222222222222222"]);
    expect(result.sold.map((row) => row.imei)).toEqual(["333333333333333", "555555555555555"]);
    expect(result.sold[0].note).toBe("Se vendió durante el conteo");
    expect(result.surplus.map((row) => row.imei)).toEqual(["444444444444444"]);
    expect(result.counters).toEqual(["Lucía", "Tomás"]);
  });

  it("writes full Spanish sentences with a 24 hour clock", () => {
    expect(clockIn(at, zone)).toBe("11:10");
    expect(openedClause(at, zone)).toBe("abrió un control de stock a las 11:10.");
    expect(closedClause({ at, timeZone: zone, counters: ["Lucía Rey", "Tomás"], matched: 36, missing: 3, surplus: 2, sold: 1 }))
      .toBe("cerró el control de stock a las 11:10. Contaron Lucía y Tomás. 36 coinciden · 3 faltan · 2 sobran · 1 figura vendido.");
    expect(adjustedClause({ at, timeZone: zone, archived: 3, loaded: 2 }))
      .toBe("ajustó el control de stock a las 11:10: archivó 3 faltantes con el motivo Faltante y cargó 2 sobrantes.");
    expect(recordedClause(at, zone)).toBe("dejó registrado el control de stock a las 11:10, sin cambiar el inventario.");
    const sentence = describeAudit({ action: "stockcount.opened", detail: openedClause(at, zone) });
    expect(`${"Matías"} ${sentence.verb}`.replace(/\s+/g, " ").trim()).toBe("Matías abrió un control de stock a las 11:10.");
    expect(sentence.target).toBe("");
  });

  it("rejects expected quantities inside a blind payload", () => {
    expect(blindLeak({ mine: 1, total: 2, scans: [{ imei: "1", model: "iPhone" }] })).toBeNull();
    expect(blindLeak({ expected: [] })).toBe("expected");
    expect(blindLeak({ scans: [{ price: 10 }] })).toBe("price");
    expect(blindLeak({ excludedNoImei: 3 })).toBe("excludedNoImei");
  });
});
