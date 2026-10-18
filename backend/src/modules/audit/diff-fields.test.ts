import { describe, expect, it } from "vitest";
import { diffFields, formatAuditDate, formatAuditMoney, MONEY } from "./diff-fields.js";

describe("diffFields", () => {
  it("skips an event when nothing visible changed and formats money, dates and enums", () => {
    expect(formatAuditMoney(900000)).toBe("$ 900.000");
    expect(formatAuditMoney(-12000)).toBe("-$ 12.000");
    expect(formatAuditMoney("850000.00")).toBe("$ 850.000");
    expect(formatAuditDate(new Date("2026-10-18T14:42:10.000Z"))).toMatch(/18\/10\/2026/);

    const schema = [
      { field: "price", label: "Precio", format: MONEY },
      { field: "status", label: "Estado", format: (value: unknown) => value === "DISPONIBLE" ? "Disponible" : value == null ? null : String(value) },
      { field: "soldAt", label: "Fecha", format: formatAuditDate },
      { field: "notes", label: "Notas" },
    ];
    expect(diffFields(
      { price: 900000, status: "DISPONIBLE", soldAt: "2026-10-18", notes: "Igual" },
      { price: 900000, status: "DISPONIBLE", soldAt: "2026-10-18", notes: "Igual" },
      schema,
    )).toEqual([]);

    expect(diffFields(
      { price: 900000, status: "DISPONIBLE", soldAt: new Date("2026-10-12T15:00:00.000Z"), notes: "" },
      { price: 850000, status: "VENDIDO", soldAt: new Date("2026-10-18T15:00:00.000Z"), notes: "" },
      schema,
    )).toEqual([
      { field: "price", label: "Precio", before: "$ 900.000", after: "$ 850.000" },
      { field: "status", label: "Estado", before: "Disponible", after: "VENDIDO" },
      { field: "soldAt", label: "Fecha", before: "12/10/2026", after: "18/10/2026" },
    ]);
  });
});
