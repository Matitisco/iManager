import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirstStepsHelp, FirstStepsIsland } from "./first-steps-island";

const state = vi.hoisted(() => ({
  gettingStarted: {
    eligible: true,
    dismissed: true,
    stock: 0,
    samples: 0,
    sales: false,
    team: false,
    catalog: false,
    installed: false,
    visible: false,
    storeNamed: true,
    steps: {
      store: true,
      stock: false,
      sale: false,
      team: false,
      install: false,
    },
  },
  gettingStartedError: "",
  inventory: [] as unknown[],
  sales: [] as unknown[],
  appSession: { membership: { role: "OWNER", sections: null as string[] | null } },
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
  InstallHelp: ({ onInstalled }: { onInstalled?: () => void }) => (
    <div>
      Guía PWA
      <button type="button" onClick={onInstalled}>Ya la instalé</button>
    </div>
  ),
}));

function flags(next: Partial<typeof state.gettingStarted.steps>) {
  state.gettingStarted.steps = { ...state.gettingStarted.steps, ...next };
}

describe("isla de primeros pasos", () => {
  beforeEach(() => {
    state.gettingStarted.eligible = true;
    state.gettingStarted.dismissed = true;
    state.gettingStarted.visible = false;
    state.gettingStarted.storeNamed = true;
    state.gettingStarted.stock = 0;
    state.gettingStarted.samples = 0;
    state.gettingStarted.sales = false;
    state.gettingStarted.team = false;
    state.gettingStarted.installed = false;
    state.appSession.membership.role = "OWNER";
    flags({ store: true, stock: false, sale: false, team: false, install: false });
    vi.clearAllMocks();
  });

  it("arranca en 1 de 5, tacha lo hecho y solo se minimiza", () => {
    render(<FirstStepsIsland />);
    expect(screen.queryByRole("button", { name: "Cerrar Primeros pasos" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Primeros pasos, 1 de 5" }));
    expect(screen.getByText("1 de 5 · a tu ritmo")).toBeVisible();
    expect(screen.getByTestId("first-step-store")).toHaveAttribute("data-done", "true");
    expect(screen.getByTestId("first-step-stock")).toHaveAttribute("data-done", "false");
    expect(screen.getByText("Empezar")).toBeVisible();
    fireEvent.click(screen.getByTestId("first-step-stock").querySelector("button")!);
    expect(desk.open).toHaveBeenCalledWith({ type: "onboarding-stock" });
    fireEvent.click(screen.getByRole("button", { name: "Primeros pasos, 1 de 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimizar primeros pasos" }));
    expect(screen.getByRole("button", { name: "Primeros pasos, 1 de 5" })).toBeVisible();
    expect(state.updateGettingStarted).not.toHaveBeenCalled();
  });

  it("la ve el administrador y no el vendedor", () => {
    state.appSession.membership.role = "MANAGER";
    const view = render(<FirstStepsIsland />);
    expect(screen.getByTestId("getting-started")).toBeVisible();
    state.appSession.membership.role = "STAFF";
    view.rerender(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    expect(screen.queryByText("Primeros pasos")).toBeNull();
  });

  it("al completar los cinco deja el aviso y no festeja", () => {
    flags({ store: true, stock: true, sale: true, team: true, install: true });
    render(<FirstStepsIsland />);
    expect(screen.getByRole("status")).toHaveTextContent("Primeros pasos completos");
    expect(screen.queryByText(/Completaste/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Primeros pasos/ })).toBeNull();
  });

  it("reusa la guía de instalación y marca el paso al confirmar", async () => {
    flags({ store: true, stock: true, sale: true, team: true, install: false });
    render(<FirstStepsIsland />);
    fireEvent.click(screen.getByRole("button", { name: "Primeros pasos, 4 de 5" }));
    fireEvent.click(screen.getByTestId("first-step-install").querySelector("button")!);
    expect(screen.getByText("Guía PWA")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ya la instalé" }));
    expect(state.updateGettingStarted).toHaveBeenCalledWith({ installed: true });
    await act(async () => { await Promise.resolve(); });
  });

  it("una cuenta existente lo muestra desde Ayuda y no lo puede ocultar para siempre", () => {
    state.gettingStarted.eligible = false;
    state.gettingStarted.visible = false;
    const hidden = render(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    hidden.unmount();

    const help = render(<FirstStepsHelp />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar en Dashboard" }));
    expect(state.updateGettingStarted).toHaveBeenCalledWith({ dismissed: false, visible: true });
    help.unmount();

    state.gettingStarted.visible = true;
    state.gettingStarted.dismissed = true;
    render(<FirstStepsIsland />);
    expect(screen.getByTestId("getting-started")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cerrar Primeros pasos" })).toBeNull();
  });
});
