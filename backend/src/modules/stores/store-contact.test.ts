import { describe, expect, it } from "vitest";
import { assertStoreContact } from "./store-contact.js";

describe("store contact", () => {
  it("keeps a phone-ready email and stores the instagram handle", () => {
    expect(assertStoreContact({
      email: "  hola@tienda.test ",
      instagram: "https://instagram.com/@mi.tienda/",
    })).toEqual({
      email: "hola@tienda.test",
      instagram: "mi.tienda",
    });
  });

  it("turns blanks into null and rejects an invalid contact", () => {
    expect(assertStoreContact({ email: "  ", instagram: "@" })).toEqual({ email: null, instagram: null });
    expect(() => assertStoreContact({ email: "no-es-correo" })).toThrow(/correo/i);
    expect(() => assertStoreContact({ instagram: "mi tienda" })).toThrow(/Instagram/i);
  });
});