import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExchangeProvider } from "../exchange";
import { DeskProvider } from "../ui";
import { NewAccountDashboard } from "./NewAccountDashboard";

const open = vi.fn();
const context = vi.hoisted(() => ({
  appSession: {
    user: { displayName: "Matias" },
    store: {
      id: "store-1",
      name: "iPhone Club Palermo",
      currency: "ARS" as const,
      onboardingStartedAt: "2026-10-01",
    },
    membership: { role: "OWNER", sections: null as string[] | null },
  },
  user: { uid: "user-1" },
  sales: [] as never[],
  inventory: [] as never[],
  tradeIns: [] as never[],
  clients: [] as never[],
}));

vi.mock("../../context/AppContext", () => ({ useAppContext: () => context }));
vi.mock("../../services/members-api", () => ({ listMembers: vi.fn(async () => []) }));

describe("dashboard de cuenta nueva", () => {
  it("conserva la estructura en cero, sin plan ni prueba", async () => {
    const user = userEvent.setup();
    render(
      <ExchangeProvider settings={{ currency: "ARS", exchangeMode: "manual", exchangeSource: "blue", manualBuy: 1500, manualSell: 1555 }}>
        <DeskProvider value={{ tab: "dashboard", go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
          <NewAccountDashboard />
        </DeskProvider>
      </ExchangeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Hola, Matias" })).toBeVisible();
    expect(screen.getByText("iPhone Club Palermo")).toBeVisible();
    expect(screen.getByRole("button", { name: /Ventas del mes/ })).toHaveTextContent("Tu primera venta aparece acá");
    expect(screen.getByRole("button", { name: /En stock/ })).toHaveTextContent("Equipos disponibles");
    expect(screen.getByRole("button", { name: /Canjes en curso/ })).toHaveTextContent("Nada pendiente");
    expect(screen.getByRole("button", { name: /Saldos a cobrar/ })).toHaveTextContent("Todo al día");
    expect(screen.getByTestId("fresh-chart")).toHaveTextContent("Sin datos");
    expect(screen.getByText("Acá vas a ver tus ventas de la semana")).toBeVisible();
    expect(screen.getByTestId("fresh-activity")).toHaveTextContent("Todavía no hay movimientos");
    expect(document.querySelector(".fresh-main")).toBeTruthy();
    const copy = screen.getByTestId("fresh-dashboard").textContent ?? "";
    expect(copy).not.toMatch(/plan|trial|facturación|prueba/i);

    await user.click(screen.getByRole("button", { name: "Cargar equipo" }));
    expect(open).toHaveBeenCalledWith({ type: "onboarding-stock" });
  });
});
