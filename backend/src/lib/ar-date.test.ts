import { describe, expect, it } from "vitest";
import { formatArDate, formatStoredDate, parseArDate } from "./ar-date.js";

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
});
