import { describe, expect, it } from "vitest";
import { buildAuditReport, combineAmounts, deltaLabel, projectAmount, renderAuditReport } from "./report-math.js";

const zone = "America/Argentina/Buenos_Aires";
const september = {
  start: "2026-09-01",
  end: "2026-10-01",
  previousStart: "2026-08-02",
  previousEnd: "2026-09-01",
};

const sales = [
  { dateLabel: "15/09/2026", soldAt: new Date("2026-09-15T18:00:00Z"), status: "COMPLETADA", amount: 1_000_000, currency: "ARS", paymentMethod: "TRANSFERENCIA" },
  { dateLabel: "20/09/2026", soldAt: new Date("2026-09-20T18:00:00Z"), status: "PENDIENTE", amount: 200, currency: "USD", paymentMethod: "EFECTIVO" },
  { dateLabel: "10/09/2026", soldAt: new Date("2026-09-10T18:00:00Z"), status: "CANCELADA", amount: 500_000, currency: "ARS", paymentMethod: "TARJETA" },
  { dateLabel: "01/10/2026", soldAt: new Date("2026-10-01T15:00:00Z"), status: "COMPLETADA", amount: 999, currency: "ARS", paymentMethod: "TARJETA" },
  { dateLabel: "02/08/2026", soldAt: new Date("2026-08-02T15:00:00Z"), status: "COMPLETADA", amount: 400_000, currency: "ARS", paymentMethod: "TRANSFERENCIA" },
  { dateLabel: "01/08/2026", soldAt: new Date("2026-08-01T15:00:00Z"), status: "COMPLETADA", amount: 900_000, currency: "ARS", paymentMethod: "EFECTIVO" },
];

describe("el reporte usa las mismas cuentas que Reportes", () => {
  it("suma las ventas no canceladas del período, convierte con la cotización de venta y deja afuera el anterior", () => {
    const report = buildAuditReport({
      period: september,
      timeZone: zone,
      currency: "ARS",
      sellRate: 1000,
      sales,
      refunds: [
        { paidAt: new Date("2026-09-10T15:00:00Z"), amount: 50_000, currency: "ARS", kind: "DEVOLUCION" },
        { paidAt: new Date("2026-09-01T02:00:00.000Z"), amount: 80_000, currency: "ARS", kind: "DEVOLUCION" },
        { paidAt: new Date("2026-09-12T15:00:00Z"), amount: 10_000, currency: "ARS", kind: "PAGO" },
      ],
      stock: [
        { createdAt: new Date("2026-09-15T15:00:00Z"), status: "DISPONIBLE" },
        { createdAt: new Date("2026-09-20T15:00:00Z"), status: "VENDIDO" },
        { createdAt: new Date("2026-09-01T02:00:00Z"), status: "DISPONIBLE" },
        { createdAt: new Date("2026-09-01T03:00:00Z"), status: "EN_REVISION" },
      ],
    });
    expect(report.sales).toMatchObject({
      total: 1_200_000,
      count: 2,
      delta: "▲ 200% vs período anterior",
      payments: [
        { label: "Transferencia", total: 1_000_000 },
        { label: "Efectivo", total: 200_000 },
      ],
    });
    expect(report.returns.cancelled).toEqual({ count: 1, total: 500_000 });
    expect(report.returns.refunds).toEqual({ count: 1, total: 50_000 });
    expect(report.stock).toEqual({ entered: 3, available: 1, physicalCounts: 0 });
    expect(combineAmounts([{ amount: 200, currency: "USD" }, { amount: 1_000_000, currency: "ARS" }], "ARS", 1000)).toBe(1_200_000);
    expect(projectAmount(200, "USD", "ARS", 1000)).toEqual({ value: 200_000, blocked: false });
    expect(deltaLabel(1_200_000, 400_000)).toBe("▲ 200% vs período anterior");
  });

  it("sin cotización no convierte y lo dice igual que Reportes", () => {
    const report = buildAuditReport({
      period: september,
      timeZone: zone,
      currency: "ARS",
      sellRate: null,
      sales,
      refunds: [],
      stock: [],
    });
    expect(report.sales.total).toBeNull();
    expect(report.sales.delta).toBeNull();
    expect(report.sales.payments).toEqual([]);
    const text = renderAuditReport("Casa\nNorte", report);
    expect(text).toContain("Facturación: sin cotización");
    expect(text).toContain("Diferencias de conteo físico: no hay un conteo cargado en este período.");
    expect(text).not.toContain("\nNorte");
  });
});
