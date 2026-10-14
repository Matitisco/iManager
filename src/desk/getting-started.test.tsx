import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GettingStarted } from "./getting-started";
const state = vi.hoisted(() => ({
  gettingStarted: {
    eligible: true,
    dismissed: false,
    stock: 3,
    sales: false,
    team: true,
    catalog: false,
    installed: false,
    videoWatched: true,
  },
  gettingStartedError: "",
  inventory: [],
  sales: [],
  publicCatalog: null,
  appSession: { membership: { role: "OWNER", sections: null } },
  refreshGettingStarted: vi.fn(async () => undefined),
  updateGettingStarted: vi.fn(async () => undefined),
}));
const desk = vi.hoisted(() => ({ open: vi.fn(), go: vi.fn() }));
vi.mock("../context/AppContext", () => ({ useAppContext: () => state }));
vi.mock("./ui", () => ({ useDesk: () => desk, Dialog: () => null }));
vi.mock("../lib/pwa", () => ({
  isAppInstalled: () => false,
  subscribeInstall: () => () => undefined,
}));
vi.mock("../components/InstallHelp", () => ({
  InstallHelp: () => <div>Guía PWA</div>,
}));
describe("Primeros pasos pendientes", () => {
  beforeEach(() => {
    state.gettingStarted.dismissed = false;
    state.appSession.membership.role = "OWNER";
    state.gettingStarted.team = true;
    vi.clearAllMocks();
  });
  it("muestra solo pendientes y cuenta los completados del recorrido", () => {
    render(<GettingStarted />);
    expect(screen.getByText("2 de 5 · lo hacés cuando quieras")).toBeVisible();
    expect(screen.queryByTestId("first-step-stock")).toBeNull();
    expect(screen.queryByTestId("first-step-team")).toBeNull();
    expect(screen.queryByTestId("first-step-video")).toBeNull();
    expect(screen.getByTestId("first-step-catalog")).toBeVisible();
    fireEvent.click(screen.getByTestId("first-step-install"));
    expect(screen.getByText("Guía PWA")).toBeVisible();
  });
  it("reutiliza invitación y oculta ese paso a empleados", () => {
    state.gettingStarted.team = false;
    const view = render(<GettingStarted />);
    fireEvent.click(screen.getByTestId("first-step-team"));
    expect(desk.open).toHaveBeenCalledWith({ type: "invite" });
    state.appSession.membership.role = "STAFF";
    view.rerender(<GettingStarted />);
    expect(screen.queryByTestId("first-step-team")).toBeNull();
    expect(screen.queryByTestId("first-step-catalog")).toBeNull();
  });
  it("persiste el descarte y Ayuda permite reabrirlo", () => {
    const view = render(<GettingStarted />);
    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar Primeros pasos" }),
    );
    expect(state.updateGettingStarted).toHaveBeenCalledWith({
      dismissed: true,
    });
    state.gettingStarted.dismissed = true;
    view.rerender(<GettingStarted />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    view.rerender(<GettingStarted force />);
    expect(
      screen.getByRole("button", { name: "Mostrar en Dashboard" }),
    ).toBeVisible();
  });
});
