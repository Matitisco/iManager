import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";
import { convertMoney, positiveRate } from "./money-currency.js";

describe("positiveRate", () => {
  it("reads a Prisma decimal even when it is not the imported class", () => {
    expect(positiveRate(new Decimal("500.5"))).toBe(500.5);
    expect(positiveRate({ toNumber: () => 700 })).toBe(700);
    expect(positiveRate(1200)).toBe(1200);
    expect(positiveRate("800")).toBe(800);
    expect(positiveRate(0)).toBeNull();
    expect(positiveRate(null)).toBeNull();
    expect(positiveRate("")).toBeNull();
  });
});

describe('convertMoney', () => {
  it('convierte ambas direcciones y redondea los centavos de cada movimiento con Decimal', () => {
    expect(convertMoney('500310', 'ARS', 'USD', new Decimal(1000)).toString()).toBe('500.31');
    expect(convertMoney('500.31', 'USD', 'ARS', 1000).toString()).toBe('500310');
    expect(convertMoney('1005', 'ARS', 'USD', 1000).toString()).toBe('1.01');
    expect(convertMoney('1004', 'ARS', 'USD', 1000).toString()).toBe('1');
  });

  it.each([null, 0, -1, NaN, Infinity])('exige cotización válida sólo para convertir importes no nulos (%s)', rate => {
    expect(() => convertMoney(1, 'ARS', 'USD', rate)).toThrow('Revisá la cotización');
    expect(convertMoney(0, 'ARS', 'USD', rate).toString()).toBe('0');
    expect(convertMoney('500.31', 'USD', 'USD', rate).toString()).toBe('500.31');
  });
});
