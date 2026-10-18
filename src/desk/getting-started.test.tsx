import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  progressUnavailable: false,
  inventory: [] as unknown[],
  sales: [] as unknown[],
  appSession: {
    user: { id: "user-1" }, store: { id: "store-1" },
    membership: { role: "OWNER", sections: null as string[] | null },
  },
  refreshGettingStarted: vi.fn(async () => undefined),
  updateGettingStarted: vi.fn(async () => undefined),
}));
const desk = vi.hoisted(() => ({ open: vi.fn(), go: vi.fn() }));

vi.mock("../context/AppContext", () => ({
  useAppContext: () => ({ ...state, gettingStarted: state.progressUnavailable ? null : state.gettingStarted }),
}));
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
    state.gettingStartedError = "";
    state.progressUnavailable = false;
    state.appSession.membership.role = "OWNER";
    state.appSession.user.id = "user-1";
    state.appSession.store.id = "store-1";
    flags({ store: true, stock: false, sale: false, team: false, install: false });
    vi.clearAllMocks();
  });
  afterEach(() => { vi.useRealTimers(); });

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

  it("la ve el socio y no el empleado", () => {
    state.appSession.membership.role = "MANAGER";
    const view = render(<FirstStepsIsland />);
    expect(screen.getByTestId("getting-started")).toBeVisible();
    state.appSession.membership.role = "STAFF";
    view.rerender(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    expect(screen.queryByText("Primeros pasos")).toBeNull();
  });

  it("al completar los cinco muestra Listo cuatro segundos y persiste el cierre al recargar", () => {
    vi.useFakeTimers();
    const view = render(<StrictMode><FirstStepsIsland /></StrictMode>);
    flags({ store: true, stock: true, sale: true, team: true, install: true });
    view.rerender(<StrictMode><FirstStepsIsland /></StrictMode>);
    expect(screen.getByRole("status")).toHaveTextContent("Listo · 5/5");
    expect(screen.queryByText(/Completaste/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Primeros pasos/ })).toBeNull();
    act(() => { vi.advanceTimersByTime(3999); });
    expect(screen.getByRole("status")).toBeVisible();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByTestId("getting-started")).toBeNull();
    view.unmount();
    const reloaded = render(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    // Even a temporarily stale progress response cannot bring the island back.
    flags({ install: false });
    reloaded.rerender(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    reloaded.unmount();
  });

  it("no muestra el aviso si los cinco ya estaban completos al cargar", () => {
    flags({ store: true, stock: true, sale: true, team: true, install: true });
    render(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    expect(state.updateGettingStarted).not.toHaveBeenCalled();
  });

  it("no repite Listo si se recarga durante los cuatro segundos", () => {
    const view = render(<FirstStepsIsland />);
    flags({ store: true, stock: true, sale: true, team: true, install: true });
    view.rerender(<FirstStepsIsland />);
    expect(screen.getByRole("status")).toHaveTextContent("Listo · 5/5");
    view.unmount();
    render(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
  });

  it("una isla completada tampoco reaparece como error si no se puede cargar el progreso", () => {
    localStorage.setItem("imanager-first-steps-completed:user-1:store-1", "true");
    state.progressUnavailable = true;
    state.gettingStartedError = "No se pudieron cargar tus primeros pasos.";
    const view = render(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    view.unmount();
    localStorage.clear();
    render(<FirstStepsIsland />);
    expect(screen.getByRole("alert")).toHaveTextContent(state.gettingStartedError);
  });

  it("mantiene el cierre separado por usuario y tienda", () => {
    localStorage.setItem("imanager-first-steps-completed:user-1:store-1", "true");
    const view = render(<FirstStepsIsland />);
    expect(screen.queryByTestId("getting-started")).toBeNull();
    state.appSession.store.id = "store-2";
    view.rerender(<FirstStepsIsland />);
    expect(screen.getByRole("button", { name: "Primeros pasos, 1 de 5" })).toBeVisible();
    state.appSession.store.id = "store-1";
    state.appSession.user.id = "user-2";
    view.rerender(<FirstStepsIsland />);
    expect(screen.getByRole("button", { name: "Primeros pasos, 1 de 5" })).toBeVisible();
  });

  it("conserva el nombre accesible completo y el número del anillo móvil", () => {
    flags({ stock: true });
    render(<FirstStepsIsland />);
    const pill = screen.getByRole("button", { name: "Primeros pasos, 2 de 5" });
    expect(pill.querySelector(".steps-ring span")).toHaveTextContent("2/5");
    expect(pill.querySelector(".steps-ring")).toHaveAttribute("aria-hidden", "true");
  });

  it("retira el scrim y la clase de panel abierto al completar desde el panel", () => {
    vi.useFakeTimers();
    const view = render(<div className="desk-app"><FirstStepsIsland /></div>);
    fireEvent.click(screen.getByRole("button", { name: "Primeros pasos, 1 de 5" }));
    expect(document.querySelector(".desk-app")).toHaveClass("steps-open");
    expect(document.querySelector(".steps-scrim")).toBeInTheDocument();
    flags({ store: true, stock: true, sale: true, team: true, install: true });
    view.rerender(<div className="desk-app"><FirstStepsIsland /></div>);
    expect(screen.getByRole("status")).toHaveTextContent("Listo · 5/5");
    expect(document.querySelector(".steps-scrim")).not.toBeInTheDocument();
    expect(document.querySelector(".desk-app")).not.toHaveClass("steps-open");
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByTestId("getting-started")).toBeNull();
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
