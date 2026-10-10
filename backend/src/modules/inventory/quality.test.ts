import { describe, expect, it } from "vitest";
import { inventoryGrade, isUsedCondition, parseQuality } from "./quality.js";

describe("device quality", () => {
  it("recognizes a used condition and ignores new or blank ones", () => {
    expect(isUsedCondition("USADO")).toBe(true);
    expect(isUsedCondition(" usado ")).toBe(true);
    expect(isUsedCondition("Used")).toBe(true);
    expect(isUsedCondition("NUEVO")).toBe(false);
    expect(isUsedCondition("PRE-OWNED")).toBe(false);
    expect(isUsedCondition("")).toBe(false);
    expect(isUsedCondition(null)).toBe(false);
  });

  it("accepts the cosmetic scale and treats blank markers as unset", () => {
    expect(parseQuality("A+")).toEqual({ ok: true, grade: "A+" });
    expect(parseQuality("a")).toEqual({ ok: true, grade: "A" });
    expect(parseQuality(" B ")).toEqual({ ok: true, grade: "B" });
    expect(parseQuality("c")).toEqual({ ok: true, grade: "C" });
    expect(parseQuality("")).toEqual({ ok: true, grade: "" });
    expect(parseQuality("N/A")).toEqual({ ok: true, grade: "" });
    expect(parseQuality("—")).toEqual({ ok: true, grade: "" });
    expect(parseQuality(null)).toEqual({ ok: true, grade: "" });
  });

  it("rejects a grade outside the scale", () => {
    expect(parseQuality("D").ok).toBe(false);
    expect(parseQuality("excelente").ok).toBe(false);
  });

  it("keeps a grade only for used devices and clears it otherwise", () => {
    expect(inventoryGrade("USADO", "A+")).toEqual({ ok: true, grade: "A+" });
    expect(inventoryGrade("USADO", "")).toEqual({ ok: true, grade: "" });
    expect(inventoryGrade("USADO", "Z").ok).toBe(false);
    expect(inventoryGrade("NUEVO", "A+")).toEqual({ ok: true, grade: "" });
    expect(inventoryGrade("PRE-OWNED", "B")).toEqual({ ok: true, grade: "" });
    expect(inventoryGrade("", "A")).toEqual({ ok: true, grade: "" });
  });
});
