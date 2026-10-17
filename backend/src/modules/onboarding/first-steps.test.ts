import { describe, expect, it } from "vitest";
import {
  evaluateFirstSteps,
  firstStepsVisibleTo,
  saleStepDone,
  stockStepDone,
  storeStepDone,
  teamStepDone,
} from "./first-steps.js";

describe("primeros pasos", () => {
  it("marca cada paso con la regla de completitud", () => {
    expect(storeStepDone("  iPhone Club  ")).toBe(true);
    expect(storeStepDone("   ")).toBe(false);
    expect(storeStepDone(null)).toBe(false);
    expect(stockStepDone(0)).toBe(false);
    expect(stockStepDone(1)).toBe(true);
    expect(saleStepDone(0)).toBe(false);
    expect(saleStepDone(1)).toBe(true);
    expect(teamStepDone(1, 0)).toBe(false);
    expect(teamStepDone(1, 1)).toBe(true);
    expect(teamStepDone(2, 0)).toBe(true);

    expect(
      evaluateFirstSteps({
        storeName: "Palermo",
        inventoryItems: 0,
        sales: 0,
        members: 1,
        invitations: 0,
        installed: false,
      }),
    ).toEqual({
      store: true,
      stock: false,
      sale: false,
      team: false,
      install: false,
    });

    expect(
      evaluateFirstSteps({
        storeName: "Palermo",
        inventoryItems: 3,
        sales: 1,
        members: 1,
        invitations: 1,
        installed: true,
      }),
    ).toEqual({
      store: true,
      stock: true,
      sale: true,
      team: true,
      install: true,
    });
  });

  it("solo el dueño y el administrador ven los pasos", () => {
    expect(firstStepsVisibleTo("OWNER")).toBe(true);
    expect(firstStepsVisibleTo("MANAGER")).toBe(true);
    expect(firstStepsVisibleTo("STAFF")).toBe(false);
    expect(firstStepsVisibleTo(null)).toBe(false);
    expect(firstStepsVisibleTo(undefined)).toBe(false);
  });
});
