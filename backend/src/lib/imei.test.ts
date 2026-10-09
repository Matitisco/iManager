import { describe, expect, it } from "vitest";
import { IMEI_FORMAT_MESSAGE, parseOptionalImei, zodOptionalImei } from "./imei.js";

describe("parseOptionalImei", () => {
  it("treats empty values as null", () => {
    expect(parseOptionalImei("")).toEqual({ ok: true, imei: null });
    expect(parseOptionalImei("   ")).toEqual({ ok: true, imei: null });
    expect(parseOptionalImei(null)).toEqual({ ok: true, imei: null });
    expect(parseOptionalImei(undefined)).toEqual({ ok: true, imei: null });
  });

  it("keeps a 15-digit IMEI", () => {
    expect(parseOptionalImei(" 350000000000095 ")).toEqual({ ok: true, imei: "350000000000095" });
  });

  it("rejects any other format", () => {
    expect(parseOptionalImei("12345")).toEqual({ ok: false, message: IMEI_FORMAT_MESSAGE });
    expect(parseOptionalImei("IMEI-1234567890")).toEqual({ ok: false, message: IMEI_FORMAT_MESSAGE });
    expect(parseOptionalImei("3500000000000951")).toEqual({ ok: false, message: IMEI_FORMAT_MESSAGE });
  });
});

describe("zodOptionalImei", () => {
  const schema = zodOptionalImei();

  it("accepts an empty string and a 15-digit value", () => {
    expect(schema.parse("")).toBe("");
    expect(schema.parse("350000000000095")).toBe("350000000000095");
  });

  it("rejects a partial IMEI", () => {
    const result = schema.safeParse("12345");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(IMEI_FORMAT_MESSAGE);
  });
});
