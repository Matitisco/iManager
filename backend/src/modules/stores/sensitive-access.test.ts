import { describe, expect, it } from "vitest";
import { canManageSensitive } from "./sensitive-access.js";

describe("canManageSensitive", () => {
  it("allows owners and managers by default and blocks staff", () => {
    expect(canManageSensitive({ role: "OWNER" })).toBe(true);
    expect(canManageSensitive({ role: "OWNER", sensitiveAccess: false })).toBe(true);
    expect(canManageSensitive({ role: "MANAGER" })).toBe(true);
    expect(canManageSensitive({ role: "MANAGER", sensitiveAccess: null })).toBe(true);
    expect(canManageSensitive({ role: "STAFF" })).toBe(false);
    expect(canManageSensitive({ role: "STAFF", sensitiveAccess: null })).toBe(false);
  });

  it("lets an explicit flag grant or revoke the permission", () => {
    expect(canManageSensitive({ role: "STAFF", sensitiveAccess: true })).toBe(true);
    expect(canManageSensitive({ role: "MANAGER", sensitiveAccess: false })).toBe(false);
    expect(canManageSensitive(null)).toBe(false);
  });
});
