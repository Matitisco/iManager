import { describe, expect, it } from "vitest";
import { formatArDate, formatStoredDate, parseArDate, parseArDateOr } from "./ar-date.js";

describe("Argentine dates", () => {
  it("formats and parses day/month/year without swapping the month", () => {
    expect(formatArDate(new Date(2026, 9, 7, 12))).toBe("07/10/2026");
    expect(parseArDate("07/10/2026")).toEqual(new Date(2026, 9, 7, 12));
    expect(parseArDate("7/10/2026")?.getMonth()).toBe(9);
  });

  it("accepts ISO days and legacy Spanish labels", () => {
    expect(formatArDate(parseArDate("2026-10-07")!)).toBe("07/10/2026");
    expect(formatStoredDate("07 de oct de 2026", new Date())).toBe("07/10/2026");
    expect(formatStoredDate("07 oct. 2026", new Date())).toBe("07/10/2026");
    expect(parseArDate("31/04/2026")).toBeNull();
  });

  it("accepts dashes, dots and two-digit years used in shop spreadsheets", () => {
    expect(formatArDate(parseArDate("7-10-2026")!)).toBe("07/10/2026");
    expect(formatArDate(parseArDate("07.10.2026")!)).toBe("07/10/2026");
    expect(formatArDate(parseArDate("7/10/26")!)).toBe("07/10/2026");
    expect(formatArDate(parseArDate("3-oct-2026")!)).toBe("03/10/2026");
  });

  it("falls back when the label is not a date", () => {
    const fallback = new Date(2026, 3, 8, 12);
    expect(parseArDateOr("07/10/2026", fallback)).toEqual(new Date(2026, 9, 7, 12));
    expect(parseArDateOr("N/A", fallback)).toBe(fallback);
    expect(parseArDateOr(undefined, fallback)).toBe(fallback);
  });
});
