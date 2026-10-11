import { describe, expect, it } from "vitest";
import { assertStoreContact, requireInstagram } from "./store-contact.js";

describe("store contact", () => {
  it("keeps a phone-ready email and stores the instagram handle", () => {
    expect(assertStoreContact({
      email: "  hola@tienda.test ",
      instagram: "https://instagram.com/@mi.tienda/",
    })).toEqual({
      email: "hola@tienda.test",
      instagram: "mi.tienda",
    });
    expect(requireInstagram("https://www.instagram.com/mi.tienda/?hl=es")).toBe("mi.tienda");
    expect(requireInstagram("  @MiTienda ")).toBe("MiTienda");
  });

  it("rejects a blank or invalid instagram and an invalid email", () => {
    expect(assertStoreContact({ email: "  ", instagram: "@ok" })).toEqual({ email: null, instagram: "ok" });
    expect(() => assertStoreContact({ instagram: "@" })).toThrow(/Instagram/);
    expect(() => assertStoreContact({ instagram: "" })).toThrow(/Instagram/);
    expect(() => assertStoreContact({ instagram: null })).toThrow(/Instagram/);
    expect(() => assertStoreContact({ email: "no-es-correo" })).toThrow(/correo/i);
    expect(() => assertStoreContact({ instagram: "mi tienda" })).toThrow(/perfil/i);
    expect(() => assertStoreContact({ instagram: "https://example.com/tienda" })).toThrow(/perfil/i);
  });
});
