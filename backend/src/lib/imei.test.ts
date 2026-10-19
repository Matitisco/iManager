import { describe, expect, it } from "vitest";
import { IMEI_FORMAT_MESSAGE, imeiPassesLuhn, parseOptionalImei, zodOptionalImei } from "./imei.js";

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

describe("imeiPassesLuhn", () => {
  it("checks the digit without changing the stored format rule", () => {
    expect(imeiPassesLuhn("490154203237518")).toBe(true);
    expect(imeiPassesLuhn("352098117744522")).toBe(true);
    expect(imeiPassesLuhn("352098117744521")).toBe(false);
    expect(parseOptionalImei("352098117744521")).toEqual({ ok: true, imei: "352098117744521" });
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
