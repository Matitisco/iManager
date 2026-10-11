import { describe, expect, it } from "vitest";
import { normalizeCustomFields } from "./custom-fields.js";

describe("normalizeCustomFields", () => {
  it("stores an empty object when there are no custom fields", () => {
    expect(normalizeCustomFields(undefined)).toEqual({});
    expect(normalizeCustomFields(null)).toEqual({});
    expect(normalizeCustomFields({})).toEqual({});
  });

  it("keeps the given custom fields", () => {
    expect(normalizeCustomFields({ color: "Azul", tags: ["a"] })).toEqual({ color: "Azul", tags: ["a"] });
  });
});
