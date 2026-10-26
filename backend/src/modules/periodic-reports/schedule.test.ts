import { afterEach, describe, expect, it, vi } from "vitest";
import { daysBetween, latestDuePeriod, periodLabel } from "./schedule.js";


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

describe('weekly schedule', () => {
  const zone = 'America/Argentina/Buenos_Aires';
  it('closes Monday to Monday at the exact local minute', () => {
    expect(latestDuePeriod(new Date('2026-10-26T11:59:59Z'), zone, 'WEEKLY').start).toBe('2026-10-12');
    expect(latestDuePeriod(new Date('2026-10-26T12:00:00Z'), zone, 'WEEKLY')).toMatchObject({ start: '2026-10-19', end: '2026-10-26' });
  });
  it('Wednesday delivery still reports the previous Monday-to-Monday week', () => {
    const config = { sendDay: 3, sendTime: '14:35' };
    expect(latestDuePeriod(new Date('2026-10-28T17:34:59Z'), zone, 'WEEKLY', config).start).toBe('2026-10-12');
    expect(latestDuePeriod(new Date('2026-10-28T17:35:00Z'), zone, 'WEEKLY', config).start).toBe('2026-10-19');
    expect(latestDuePeriod(new Date('2026-11-01T18:00:00Z'), zone, 'WEEKLY', config).end).toBe('2026-10-26');
  });
  it('handles DST, year changes and midnight in the store zone', () => {
    expect(latestDuePeriod(new Date('2026-03-09T13:00:00Z'), 'America/New_York', 'WEEKLY').end).toBe('2026-03-09');
    expect(latestDuePeriod(new Date('2026-11-02T14:00:00Z'), 'America/New_York', 'WEEKLY').end).toBe('2026-11-02');
    expect(latestDuePeriod(new Date('2027-01-04T03:00:00Z'), zone, 'WEEKLY', { sendTime: '00:00' }).start).toBe('2026-12-28');
  });
  it('honors configurable monthly and half-monthly day/time', () => {
    expect(latestDuePeriod(new Date('2026-10-05T12:00:00Z'), zone, 'MONTHLY', { sendDay: 5, sendTime: '09:00' }).start).toBe('2026-09-01');
    expect(latestDuePeriod(new Date('2026-10-05T11:59:00Z'), zone, 'MONTHLY', { sendDay: 5, sendTime: '09:00' }).start).toBe('2026-08-01');
    expect(latestDuePeriod(new Date('2026-10-18T12:00:00Z'), zone, 'BIWEEKLY', { sendDay: 3, sendTime: '09:00' }).start).toBe('2026-10-01');
  });
});

it('clamps the second half-month delivery day to the end of February', () => {
  expect(latestDuePeriod(new Date('2026-02-28T12:00:00Z'), 'America/Argentina/Buenos_Aires', 'BIWEEKLY', { sendDay: 15, sendTime: '09:00' })).toMatchObject({ start: '2026-02-01', end: '2026-02-16' });
});
