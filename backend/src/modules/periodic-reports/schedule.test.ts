import { afterEach, describe, expect, it, vi } from "vitest";
import { daysBetween, latestDuePeriod, periodLabel } from "./schedule.js";
import { startPeriodicReports } from "./service.js";

describe("cierre del reporte en la zona de la tienda", () => {
  const zone = "America/Argentina/Buenos_Aires";

  it("el mensual cierra a las 08:00 de Argentina y no incluye el mes en curso", () => {
    expect(latestDuePeriod(new Date("2026-10-01T10:59:00Z"), zone, "MONTHLY")).toMatchObject({
      key: "MONTHLY:2026-08-01:2026-09-01",
      start: "2026-08-01",
      end: "2026-09-01",
      previousStart: "2026-07-01",
      previousEnd: "2026-08-01",
    });
    const september = latestDuePeriod(new Date("2026-10-01T11:00:00Z"), zone, "MONTHLY");
    expect(september).toMatchObject({ key: "MONTHLY:2026-09-01:2026-10-01", start: "2026-09-01", end: "2026-10-01" });
    expect(daysBetween(september.start, september.end)).toBe(30);
    expect(september.previousStart).toBe("2026-08-02");
    expect(latestDuePeriod(new Date("2026-10-19T15:00:00Z"), zone, "MONTHLY").key).toBe("MONTHLY:2026-09-01:2026-10-01");
    expect(periodLabel(september.start, september.end)).toBe("01/09/2026 al 30/09/2026");
  });

  it("cada 15 días cierra el 1 y el 16 a las 08:00, también en febrero", () => {
    expect(latestDuePeriod(new Date("2026-10-16T10:59:00Z"), zone, "BIWEEKLY").key).toBe("BIWEEKLY:2026-09-16:2026-10-01");
    expect(latestDuePeriod(new Date("2026-10-16T11:00:00Z"), zone, "BIWEEKLY")).toMatchObject({
      start: "2026-10-01",
      end: "2026-10-16",
      previousStart: "2026-09-16",
    });
    expect(latestDuePeriod(new Date("2026-10-01T10:59:00Z"), zone, "BIWEEKLY").key).toBe("BIWEEKLY:2026-09-01:2026-09-16");
    expect(latestDuePeriod(new Date("2026-03-01T11:00:00Z"), zone, "BIWEEKLY")).toMatchObject({
      start: "2026-02-16",
      end: "2026-03-01",
    });
    expect(periodLabel("2026-02-16", "2026-03-01")).toBe("16/02/2026 al 28/02/2026");
  });

  it("usa la zona horaria de la tienda y no la del servidor", () => {
    const instant = new Date("2026-10-01T08:30:00Z");
    expect(latestDuePeriod(instant, "UTC", "MONTHLY").key).toBe("MONTHLY:2026-09-01:2026-10-01");
    expect(latestDuePeriod(instant, zone, "MONTHLY").key).toBe("MONTHLY:2026-08-01:2026-09-01");
  });
});

describe("programación", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("apagada no programa nada", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const stop = startPeriodicReports({ info: vi.fn(), warn: vi.fn() }, { enabled: false, run });
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    expect(run).not.toHaveBeenCalled();
    stop();
  });

  it("revisa a los 15 segundos y después cada hora", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const info = vi.fn();
    const stop = startPeriodicReports({ info, warn: vi.fn() }, { enabled: true, run });
    expect(info).toHaveBeenCalledWith("Reporte automático: revisión cada hora, envío a las 08:00, hora de la tienda.");
    await vi.advanceTimersByTimeAsync(14_000);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
