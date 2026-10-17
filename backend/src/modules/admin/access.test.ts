import { describe, expect, it } from "vitest";
import { isPlatformAdmin, maskEmail, platformAdminEmails } from "./access.js";

describe("platform admin allowlist", () => {
  it("treats a missing list as nobody", () => {
    expect(platformAdminEmails(undefined).size).toBe(0);
    expect(platformAdminEmails("").size).toBe(0);
    expect(isPlatformAdmin("admin@internal.test", undefined)).toBe(false);
    expect(isPlatformAdmin(null, "admin@internal.test")).toBe(false);
  });

  it("matches emails without caring about case or surrounding spaces", () => {
    const raw = " Admin@Internal.Test , second@internal.test, not-an-email ";
    expect([...platformAdminEmails(raw)]).toEqual(["admin@internal.test", "second@internal.test"]);
    expect(isPlatformAdmin("ADMIN@internal.test", raw)).toBe(true);
    expect(isPlatformAdmin(" second@internal.test ", raw)).toBe(true);
    expect(isPlatformAdmin("other@internal.test", raw)).toBe(false);
  });
});

describe("maskEmail", () => {
  it("keeps two characters and the domain", () => {
    expect(maskEmail("Matias.Owner@Tienda.com")).toBe("Ma***@tienda.com");
    expect(maskEmail("ab@Example.com")).toBe("ab***@example.com");
    expect(maskEmail("a@tienda.com")).toBe("a***@tienda.com");
  });

  it("drops addresses that are not a local part plus a domain", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("   ")).toBeNull();
    expect(maskEmail("sin-arroba")).toBeNull();
    expect(maskEmail("@tienda.com")).toBeNull();
    expect(maskEmail("dueño@")).toBeNull();
  });
});
