import { describe, expect, it } from "vitest";
import {
  esCount,
  onboardingPayload,
  onboardingTotals,
  prepareOnboardingRows,
  recognizedLinesHeading,
  recognizedSlices,
  unrecognizedNote,
  withoutCurrencyNote,
} from "./onboarding-stock";
import type { ImportAnalysis } from "../services/import-api";

const analysis: ImportAnalysis = {
  source: "model",
  notice: null,
  currency: "USD",
  plan: [],
  rows: [
    {
      model: "iPhone 13",
      price: "520",
      currency: "USD",
      quantity: "2",
      condition: "USADO",
    },
    {
      model: "iPhone 14",
      price: "650000",
      currency: "ARS",
      quantity: "1",
      condition: "USADO",
    },
  ],
  review: [
    { line: 1, original: "13 x2", dudas: ["Falta capacidad"] },
    { line: 2, original: "14", dudas: [] },
  ],
  summary: { sheetCount: 1, rowCount: 2, sheets: [] },
};
describe("stock del onboarding", () => {
  it("cuenta unidades, convierte monedas y conserva la marca por equipo", () => {
    const rows = prepareOnboardingRows(analysis);
    expect(onboardingTotals(rows, 1300)).toEqual({
      count: 3,
      review: 2,
      usd: 1540,
      ars: 2002000,
      withoutCurrency: 0,
    });
    const payload = onboardingPayload(rows);
    expect(payload).toHaveLength(2);
    expect(payload[0].quantity).toBe(2);
    expect(payload[0].customFields).toEqual({
      onboardingReview: "Falta capacidad",
    });
    expect(payload[1].customFields).toEqual({});
    expect(payload[1].currency).toBe("ARS");
  });
  it("permite guardar datos pendientes con precio a definir y marca, sin inventar valores", () => {
    const rows = prepareOnboardingRows({
      ...analysis,
      rows: [
        {
          model: "iPhone 13",
          price: "",
          quantity: "1",
          currency: "USD",
          condition: "",
        },
      ],
    });
    expect(onboardingPayload(rows)[0]).toMatchObject({
      price: null,
      currency: "USD",
      condition: "USADO",
      customFields: { onboardingReview: "Falta capacidad" },
    });
  });
  it("deja afuera del total en dólares las filas sin moneda", () => {
    const rows = prepareOnboardingRows({
      ...analysis,
      rows: [
        analysis.rows[0],
        {
          model: "iPhone 14",
          price: "100",
          currency: "",
          quantity: "1",
          condition: "USADO",
        },
      ],
      review: [
        analysis.review![0],
        {
          line: 2,
          original: "14",
          dudas: ["Sin moneda: elegí ARS o USD antes de importar."],
        },
      ],
    });
    expect(rows[1].currency).toBe("");
    expect(onboardingTotals(rows, 1300)).toMatchObject({
      usd: 1040,
      ars: 1352000,
      count: 3,
      withoutCurrency: 1,
    });
    expect(onboardingTotals(rows, null)).toMatchObject({
      usd: 1040,
      ars: null,
      withoutCurrency: 1,
    });
    expect(withoutCurrencyNote(1)).toBe(
      "1 equipo sin moneda no entra en el total. Elegí ARS o USD al revisar.",
    );
    expect(withoutCurrencyNote(2)).toContain("2 equipos sin moneda");
  });
  it("parte el resultado de una sola respuesta y acuerda singular y plural", () => {
    expect(
      recognizedSlices(
        [
          { model: "iPhone 13", quantity: "1", line: 1 },
          { model: "iPhone 14", quantity: "2", line: 9 },
        ],
        12,
      ),
    ).toEqual([
      [{ model: "iPhone 13", quantity: 1 }],
      [{ model: "iPhone 14", quantity: 2 }],
    ]);
    expect(
      recognizedSlices(
        [
          { model: "iPhone 13", quantity: 1 },
          { model: "iPhone 14", quantity: 1 },
        ],
        2,
      ),
    ).toHaveLength(2);
    expect(unrecognizedNote(1)).toBe(
      "La línea sin reconocer no parece un equipo. Editala o borrala y volvé a analizar, o seguí sin ella.",
    );
    expect(unrecognizedNote(2)).toContain("Las 2 sin reconocer");
    expect(recognizedLinesHeading(1, 1)).toBe("Reconocimos 1 de 1 línea");
    expect(esCount(1, "equipo", "equipos")).toBe("1 equipo");
  });
  it("no muestra una conversión falsa sin cotización", () => {
    expect(
      onboardingTotals(prepareOnboardingRows(analysis), null),
    ).toMatchObject({ usd: null, ars: null, count: 3 });
  });
  it("conserva el valor directo en USD aunque no haya cotización disponible", () => {
    const rows = prepareOnboardingRows({
      ...analysis,
      rows: [analysis.rows[0]],
    });
    expect(onboardingTotals(rows, null)).toMatchObject({
      usd: 1040,
      ars: null,
      count: 2,
    });
  });
  it("rechaza cantidades e identificadores que duplicarían un IMEI", () => {
    expect(() =>
      onboardingPayload([{ ...analysis.rows[0], imei: "350000000000100" }]),
    ).toThrow(/cantidad 1/);
    expect(() =>
      onboardingPayload([{ ...analysis.rows[0], quantity: "0" }]),
    ).toThrow(/cantidad/);
  });
});
