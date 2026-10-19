import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../../types";
import { ExchangeProvider } from "../exchange";
import { DeskProvider } from "../ui";
import { NewAccountDashboard } from "./NewAccountDashboard";
import { DashboardScreen } from "./DashboardScreen";

const open = vi.fn();
const go = vi.fn();
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
  inventory: [] as Product[],
  tradeIns: [] as never[],
  clients: [] as never[],
}));

vi.mock("../../context/AppContext", () => ({ useAppContext: () => context }));
vi.mock("../../services/members-api", () => ({ listMembers: vi.fn(async () => []) }));

function renderDashboard(child = <NewAccountDashboard />) {
  return render(
    <ExchangeProvider settings={{ currency: "ARS", exchangeMode: "manual", exchangeSource: "blue", manualBuy: 1500, manualSell: 1555 }}>
      <DeskProvider value={{ tab: "dashboard", go, open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
        {child}
      </DeskProvider>
    </ExchangeProvider>,
  );
}

let originalMatchMedia: typeof window.matchMedia;
afterEach(() => { window.matchMedia = originalMatchMedia; });
beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  context.inventory = [];
  context.appSession.membership.role = "OWNER";
});

describe("dashboard de cuenta nueva", () => {
  it("reusa el dashboard con el flujo, cuatro métricas y estados vacíos con acciones reales", async () => {
    const user = userEvent.setup();
    // Exercise the actual new-account routing condition as well as the shared content.
    renderDashboard(<DashboardScreen />);

    expect(screen.getByText("Hola, Matias")).toHaveClass("greet");
    expect(screen.getByRole("heading", { name: "¿Qué hay para hoy?" })).toBeVisible();
    expect(screen.getByText("hoy")).toHaveClass("hl");
    expect(screen.getByRole("heading", { name: "Flujo sugerido" })).toBeVisible();
    expect(screen.getAllByText("0/3")).toHaveLength(2);
    expect(document.querySelectorAll(".dkpis .mini")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Ventas del mes/ })).toHaveTextContent("$ 0");
    expect(screen.getByRole("button", { name: /En stock/ })).toHaveTextContent("0 equipos");
    expect(screen.getByRole("button", { name: /Canjes en curso/ })).toHaveTextContent("0 en total");
    expect(screen.getByRole("button", { name: /Saldos a cobrar/ })).toHaveTextContent("0 clientes");
    const sales = within(screen.getByTestId("dashboard-sales"));
    expect(sales.getByText("Todavía no registraste ventas")).toBeVisible();
    expect(sales.getByText("Tu primera venta aparece acá")).toBeVisible();
    const trades = within(screen.getByTestId("dashboard-trades"));
    expect(trades.getByText("Sin canjes en curso")).toBeVisible();
    expect(trades.getByText("Los equipos que recibas como parte de pago aparecen acá")).toBeVisible();
    expect(document.querySelector(".dashboard-screen")?.textContent).not.toMatch(/plan|trial|facturación|prueba/i);
    expect(document.querySelector(".fresh-dash")).toBeNull();

    for (const button of screen.getAllByRole("button", { name: "Registrar venta" })) {
      await user.click(button);
      expect(open).toHaveBeenLastCalledWith({ type: "new-sale" });
    }
    await user.click(trades.getByRole("button", { name: "Nuevo canje" }));
    expect(open).toHaveBeenLastCalledWith({ type: "new-cj" });
    await user.click(screen.getByRole("button", { name: "Invitar" }));
    expect(open).toHaveBeenLastCalledWith({ type: "invite" });
    await user.click(sales.getByRole("button", { name: "Ver todas" }));
    expect(go).toHaveBeenLastCalledWith("sales");
    await user.click(trades.getByRole("button", { name: "Ver todos" }));
    expect(go).toHaveBeenLastCalledWith("tradeins");
  });

  it("oculta canjes e invitar cuando el empleado no tiene ese permiso", () => {
    context.appSession.membership = { role: "STAFF", sections: ["dashboard", "sales", "inventory", "clients"] };
    renderDashboard(<DashboardScreen />);
    expect(screen.queryByRole("button", { name: /Canjes en curso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo canje" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invitar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ventas del mes/ })).toBeInTheDocument();
  });

  it("conserva las cantidades reales de stock", () => {
    context.inventory = [
      { id: "available", status: "DISPONIBLE" },
      { id: "sold", status: "VENDIDO" },
    ] as Product[];
    renderDashboard();
    const stock = screen.getByRole("button", { name: /En stock/ });
    expect(stock).toHaveTextContent("2 equipos");
    expect(stock).toHaveTextContent("1 disponible");
  });

  it.each([
    ["OWNER", "Propietario"],
    ["MANAGER", "Socio"],
    ["STAFF", "Empleado"],
  ])("usa el nombre de rol existente para %s", (role, label) => {
    context.appSession.membership.role = role;
    renderDashboard();
    expect(screen.getByTitle(`Matias · ${label}`)).toBeVisible();
    expect(document.querySelector(".dashboard-screen")?.innerHTML).not.toMatch(/Administrador|Dueño|Vendedor/);
  });

  it("en teléfono mantiene Registrar venta dentro del flujo sugerido", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("760"), media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    const user = userEvent.setup();
    renderDashboard();
    const flow = screen.getByTestId("dashboard-register-sale");
    expect(flow.closest(".hero")).toHaveTextContent("Flujo sugerido");
    await user.click(within(flow).getByRole("button", { name: "Registrar venta" }));
    expect(open).toHaveBeenCalledWith({ type: "new-sale" });
    expect(screen.getByText("Todavía no registraste ventas")).toBeVisible();
    expect(screen.getByText("Sin canjes en curso")).toBeVisible();
  });
});
