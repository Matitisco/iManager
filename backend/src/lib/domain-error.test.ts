import { describe, expect, it } from "vitest";
import { DomainError, domainErrorFrom } from "./domain-error.js";

describe("domainErrorFrom", () => {
  it("unwraps a domain error nested in a cause chain", () => {
    const domain = new DomainError("No se puede eliminar: tiene saldo a favor ($ 15.500).", 409);
    const wrapped = new Error("transaction", { cause: new Error("prisma", { cause: domain }) });
    expect(domainErrorFrom(wrapped)).toBe(domain);
    expect(domainErrorFrom(new Error("plain"))).toBeNull();
  });
});
