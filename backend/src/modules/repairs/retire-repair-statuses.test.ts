import { describe, expect, it } from "vitest";
import { isRetiredRepairStatus } from "./retire-repair-statuses.js";

describe("retired repair statuses", () => {
  it("retires diagnóstico and both waiting labels, including the issue wording", () => {
    expect(isRetiredRepairStatus("EN_DIAGNOSTICO", "En diagnóstico")).toBe(true);
    expect(isRetiredRepairStatus("ESPERANDO_REPUESTO", "Esperando repuesto")).toBe(true);
    expect(isRetiredRepairStatus("ESPERANDO_RESPUESTA", "Esperando respuesta")).toBe(true);
    expect(isRetiredRepairStatus("CUSTOM", "Esperando respuesta")).toBe(true);
    expect(isRetiredRepairStatus("CUSTOM", "  Esperando   repuesto ")).toBe(true);
  });

  it("keeps the remaining flow even if a store reused one of those names", () => {
    expect(isRetiredRepairStatus("RECIBIDO", "Recibido")).toBe(false);
    expect(isRetiredRepairStatus("EN_REPARACION", "En diagnóstico")).toBe(false);
    expect(isRetiredRepairStatus("LISTO_PARA_RETIRAR", "Esperando respuesta")).toBe(false);
    expect(isRetiredRepairStatus("ENTREGADO")).toBe(false);
    expect(isRetiredRepairStatus("GARANTIA", "Garantía")).toBe(false);
  });
});
