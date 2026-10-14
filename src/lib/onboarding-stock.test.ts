import { describe, expect, it } from "vitest";
import {
  onboardingPayload,
  onboardingTotals,
  prepareOnboardingRows,
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
    });
    const payload = onboardingPayload(rows);
    expect(payload).toHaveLength(3);
    expect(payload[0].customFields).toEqual({
      onboardingReview: "Falta capacidad",
    });
    expect(payload[1].customFields).toEqual(payload[0].customFields);
    expect(payload[2].currency).toBe("ARS");
  });
  it("permite guardar datos pendientes con precio cero y marca, sin inventar valores", () => {
    const rows = prepareOnboardingRows({
      ...analysis,
      rows: [
        {
          model: "iPhone 13",
          price: "",
          quantity: "1",
          currency: "",
          condition: "",
        },
      ],
    });
    expect(onboardingPayload(rows)[0]).toMatchObject({
      price: 0,
      currency: "USD",
      customFields: { onboardingReview: "Falta capacidad" },
    });
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
