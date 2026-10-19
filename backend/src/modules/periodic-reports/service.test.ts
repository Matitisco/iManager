import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  periodicReportSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  sale: { findMany: vi.fn() },
  inventoryItem: { findMany: vi.fn() },
  clientPayment: { findMany: vi.fn() },
  creditNote: { findMany: vi.fn() },
}));

vi.mock("../../plugins/prisma.js", () => ({ prisma: prismaMock }));

import { DomainError } from "../../lib/domain-error.js";
import { getPeriodicReportSettings, runDueReports, savePeriodicReportSettings } from "./service.js";

const store = {
  id: "store-1",
  name: "Casa",
  currency: "ARS",
  timezone: "America/Argentina/Buenos_Aires",
  exchangeMode: "manual",
  exchangeSource: "blue",
  manualSell: 1000,
};

function settings(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "store-1",
    enabled: true,
    frequency: "MONTHLY",
    recipients: "natan@iphoneveron.test",
    lastPeriodKey: null,
    lastSentAt: null,
    lastError: null,
    store,
    ...overrides,
  };
}

describe("opt-in del reporte", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.sale.findMany.mockResolvedValue([
      { dateLabel: "15/09/2026", soldAt: new Date("2026-09-15T18:00:00Z"), status: "COMPLETADA", amount: 1000, amountCurrency: "ARS", paymentMethod: "EFECTIVO" },
    ]);
    prismaMock.inventoryItem.findMany.mockResolvedValue([]);
    prismaMock.clientPayment.findMany.mockResolvedValue([]);
    prismaMock.creditNote.findMany.mockResolvedValue([]);
    prismaMock.periodicReportSettings.update.mockResolvedValue({});
  });

  it("sin fila está apagado", async () => {
    prismaMock.periodicReportSettings.findUnique.mockResolvedValue(null);
    await expect(getPeriodicReportSettings("store-1")).resolves.toMatchObject({ enabled: false, recipients: [], frequency: "MONTHLY" });
  });

  it("guardar apagado no exige correos y guardar prendido sí", async () => {
    prismaMock.periodicReportSettings.upsert.mockImplementation(async ({ create }) => create);
    await expect(savePeriodicReportSettings("store-1", { enabled: false, frequency: "BIWEEKLY", recipients: [] })).resolves.toMatchObject({
      enabled: false,
      frequency: "BIWEEKLY",
    });
    await expect(savePeriodicReportSettings("store-1", { enabled: true, frequency: "MONTHLY", recipients: [] })).rejects.toBeInstanceOf(DomainError);
    await expect(savePeriodicReportSettings("store-1", { enabled: true, frequency: "MONTHLY", recipients: ["mal"] })).rejects.toThrow("no es válido");
    const saved = await savePeriodicReportSettings("store-1", { enabled: true, frequency: "MONTHLY", recipients: [" Natan@Tienda.test ", "natan@tienda.test"] });
    expect(saved.recipients).toEqual(["natan@tienda.test"]);
    expect(prismaMock.periodicReportSettings.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      create: expect.objectContaining({ enabled: true, recipients: "natan@tienda.test" }),
    }));
  });

  it("no manda si está apagado, si ya se envió el período o si no hay correo", async () => {
    const mailer = vi.fn(async () => undefined);
    prismaMock.periodicReportSettings.findMany.mockResolvedValueOnce([]);
    await expect(runDueReports({ now: new Date("2026-10-01T12:00:00Z"), mailer })).resolves.toBe(0);
    expect(mailer).not.toHaveBeenCalled();

    prismaMock.periodicReportSettings.findMany.mockResolvedValueOnce([
      settings({ lastPeriodKey: "MONTHLY:2026-09-01:2026-10-01" }),
    ]);
    await expect(runDueReports({ now: new Date("2026-10-01T12:00:00Z"), mailer })).resolves.toBe(0);
    expect(mailer).not.toHaveBeenCalled();

    prismaMock.periodicReportSettings.findMany.mockResolvedValueOnce([settings({ recipients: "" })]);
    await expect(runDueReports({ now: new Date("2026-10-01T12:00:00Z"), mailer })).resolves.toBe(0);
    expect(mailer).not.toHaveBeenCalled();
    expect(prismaMock.periodicReportSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { lastError: "Agregá al menos un correo para enviar el reporte." },
    }));
  });

  it("prendido manda el período cerrado y apagarlo después no vuelve a mandar", async () => {
    const mailer = vi.fn(async (_message: { to: string[]; subject: string; text: string }) => undefined);
    prismaMock.periodicReportSettings.findMany.mockResolvedValueOnce([settings()]);
    await expect(runDueReports({ now: new Date("2026-10-01T12:00:00Z"), mailer })).resolves.toBe(1);
    expect(mailer).toHaveBeenCalledWith(expect.objectContaining({
      to: ["natan@iphoneveron.test"],
      subject: "Reporte de Casa · 01/09/2026 al 30/09/2026",
    }));
    expect(mailer.mock.calls[0]?.[0]?.text).toContain("Facturación: $ 1.000");
    expect(prismaMock.periodicReportSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastPeriodKey: "MONTHLY:2026-09-01:2026-10-01", lastError: null }),
    }));

    prismaMock.periodicReportSettings.findMany.mockResolvedValueOnce([]);
    await expect(runDueReports({ now: new Date("2026-10-02T12:00:00Z"), mailer })).resolves.toBe(0);
    expect(mailer).toHaveBeenCalledTimes(1);
  });

  it("sin SMTP no marca el período como enviado", async () => {
    prismaMock.periodicReportSettings.findMany.mockResolvedValue([settings()]);
    await expect(runDueReports({ now: new Date("2026-10-01T12:00:00Z"), mailer: null, log: { info: vi.fn(), warn: vi.fn() } })).resolves.toBe(0);
    expect(prismaMock.periodicReportSettings.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { lastError: "El servidor todavía no puede enviar correos." },
    }));
    expect(prismaMock.periodicReportSettings.update.mock.calls.some((call) => "lastPeriodKey" in call[0].data)).toBe(false);
  });
});
