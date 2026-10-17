import { describe, expect, it } from "vitest";
import {
  INVITE_ROLE_SECTIONS,
  canSeeFirstSteps,
  firstStepCount,
  firstStepsOnDashboard,
  nextFirstStep,
  orderedFirstSteps,
  permissionSummary,
} from "./first-steps";

const fresh = {
  store: true,
  stock: false,
  sale: false,
  team: false,
  install: false,
};

describe("primeros pasos", () => {
  it("una cuenta nueva arranca en 1 de 5 y el siguiente paso es el stock", () => {
    const steps = orderedFirstSteps(fresh);
    expect(firstStepCount(steps)).toEqual({ done: 1, total: 5, complete: false });
    expect(nextFirstStep(steps)?.id).toBe("stock");
    expect(steps.find((step) => step.id === "store")?.done).toBe(true);
  });

  it("marca el equipo cuando hay invitación o más de un miembro, y cierra al completar los cinco", () => {
    const withTeam = orderedFirstSteps({ ...fresh, stock: true, sale: true, team: true });
    expect(nextFirstStep(withTeam)?.id).toBe("install");
    expect(firstStepCount(withTeam).done).toBe(4);
    const done = orderedFirstSteps({
      store: true,
      stock: true,
      sale: true,
      team: true,
      install: true,
    });
    expect(firstStepCount(done).complete).toBe(true);
    expect(nextFirstStep(done)).toBeNull();
  });

  it("muestra la isla solo al dueño y al administrador, y no se puede ocultar del todo", () => {
    expect(canSeeFirstSteps("OWNER")).toBe(true);
    expect(canSeeFirstSteps("MANAGER")).toBe(true);
    expect(canSeeFirstSteps("STAFF")).toBe(false);
    expect(canSeeFirstSteps(null)).toBe(false);
    expect(firstStepsOnDashboard({ eligible: true, visible: false }, "OWNER")).toBe(true);
    expect(firstStepsOnDashboard({ eligible: true, visible: false }, "STAFF")).toBe(false);
    expect(firstStepsOnDashboard({ eligible: false, visible: false }, "MANAGER")).toBe(false);
    expect(firstStepsOnDashboard({ eligible: false, visible: true }, "OWNER")).toBe(true);
  });

  it("resume los permisos del vendedor como en la invitación", () => {
    expect(permissionSummary(INVITE_ROLE_SECTIONS.STAFF)).toBe("Ventas, Inventario y Canjes");
  });
});
