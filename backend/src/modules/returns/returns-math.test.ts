import { describe, expect, it } from "vitest";
import {
  planCreditApplication,
  refundableAmount,
  resolutionError,
  returnReversal,
  stockStatusForReturn,
} from "./returns-math.js";

describe("devoluciones", () => {
  it("pide plata en un cambio o un reintegro y no la pide en una reparación de garantía", () => {
    expect(resolutionError({ resolution: "REINTEGRO", settlement: "NINGUNO", amount: 0, destination: "STOCK" })).toMatch(/nota de crédito/);
    expect(resolutionError({ resolution: "CAMBIO", settlement: "NOTA_CREDITO", amount: 100, destination: "CLIENTE" })).toMatch(/stock/);
    expect(resolutionError({ resolution: "REPARACION", settlement: "REINTEGRO", amount: 10, destination: "CLIENTE" })).toMatch(/garantía/);
    expect(resolutionError({ resolution: "REPARACION", settlement: "NINGUNO", amount: 0, destination: "STOCK" })).toMatch(/proveedor/);
    expect(resolutionError({ resolution: "REINTEGRO", settlement: "REINTEGRO", amount: 100, destination: "STOCK" })).toBeNull();
    expect(resolutionError({ resolution: "CAMBIO", settlement: "NOTA_CREDITO", amount: 100, destination: "PROVEEDOR" })).toBeNull();
    expect(resolutionError({ resolution: "REPARACION", settlement: "NINGUNO", amount: 0, destination: "CLIENTE" })).toBeNull();
  });

  it("no deja el equipo en el estado anterior ni vendido", () => {
    expect(stockStatusForReturn("VENDIDO", "DISPONIBLE", "DISPONIBLE").ok).toBe(false);
    expect(stockStatusForReturn("VENDIDO", "DISPONIBLE", "VENDIDO").ok).toBe(false);
    expect(stockStatusForReturn("EN_RMA", "DISPONIBLE", "EN_RMA").ok).toBe(false);
    expect(stockStatusForReturn("VENDIDO", "DISPONIBLE", "EN_REVISION")).toEqual({ ok: true, status: "EN_REVISION" });
    expect(stockStatusForReturn("EN_RMA", "DISPONIBLE", "devuelto")).toEqual({ ok: true, status: "DEVUELTO" });
  });

  it("toma como reintegrable solo lo cobrado de una venta completada", () => {
    expect(refundableAmount({ status: "COMPLETADA", amount: 1000, openBalance: null })).toBe(1000);
    expect(refundableAmount({ status: "COMPLETADA", amount: 1000, openBalance: 400 })).toBe(600);
    expect(refundableAmount({ status: "PENDIENTE", amount: 1000, openBalance: null })).toBe(0);
    expect(refundableAmount(null)).toBe(0);
  });

  it("aplica la nota en la misma moneda y convierte con la cotización de la venta", () => {
    const same = planCreditApplication({
      due: 800,
      currency: "ARS",
      rate: 1000,
      notes: [
        { id: "a", remaining: 300, currency: "ARS" },
        { id: "b", remaining: 700, currency: "ARS" },
      ],
    });
    expect(same).toEqual({
      ok: true,
      covered: 800,
      applications: [
        { id: "a", noteAmount: 300, saleAmount: 300 },
        { id: "b", noteAmount: 500, saleAmount: 500 },
      ],
    });
    const mixed = planCreditApplication({
      due: 200_000,
      currency: "ARS",
      rate: 1000,
      notes: [{ id: "usd", remaining: 50, currency: "USD" }],
    });
    expect(mixed).toEqual({
      ok: true,
      covered: 50_000,
      applications: [{ id: "usd", noteAmount: 50, saleAmount: 50_000 }],
    });
    expect(planCreditApplication({
      due: 100,
      currency: "ARS",
      rate: null,
      notes: [{ id: "usd", remaining: 10, currency: "USD" }],
    }).ok).toBe(false);
  });

  it("revierte el margen en proporción al importe devuelto", () => {
    expect(returnReversal({ saleAmount: 1000, moneyAmount: 1000, itemCost: 600 })).toEqual({ amount: 1000, cost: 600 });
    expect(returnReversal({ saleAmount: 1000, moneyAmount: 250, itemCost: 600 })).toEqual({ amount: 250, cost: 150 });
  });
});
