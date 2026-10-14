import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockOnboarding } from "./StockOnboarding";
const context = vi.hoisted(() => ({
  user: { uid: "u" },
  appSession: {
    store: {
      name: "Casa",
      currency: "USD",
      onboardingStartedAt: "2026-10-14",
      onboardingCompletedAt: undefined as string | undefined,
    },
    membership: { role: "OWNER" },
  },
  inventory: [],
  reloadInventory: vi.fn(async () => undefined),
  reloadSession: vi.fn(async () => undefined),
  updateGettingStarted: vi.fn(async () => undefined),
  refreshGettingStarted: vi.fn(async () => undefined),
}));
const api = vi.hoisted(() => ({
  analyzeInventoryTextProgress: vi.fn(),
  importBackendRows: vi.fn(),
}));
vi.mock("../context/AppContext", () => ({ useAppContext: () => context }));
vi.mock("../desk/exchange", () => ({
  ExchangeProvider: ({ children }: { children: React.ReactNode }) => children,
  exchangeFromStore: () => ({}),
  useMoney: () => ({ rate: 1300 }),
}));
vi.mock("../desk/DeskOverlays", () => ({ DeskOverlays: () => null }));
vi.mock("../components/ImportModal", () => ({ ImportModal: () => null }));
vi.mock("../services/import-api", () => api);
const analysis = {
  currency: "USD",
  rows: [
    {
      model: "iPhone 13",
      price: "420",
      currency: "USD",
      condition: "USADO",
      quantity: "1",
    },
    {
      model: "iPhone 14",
      price: "590",
      currency: "USD",
      condition: "USADO",
      quantity: "1",
    },
  ],
  review: [],
  discarded: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  context.appSession.store = {
    name: "Casa",
    currency: "USD",
    onboardingStartedAt: "2026-10-14",
    onboardingCompletedAt: undefined,
  };
  api.analyzeInventoryTextProgress.mockResolvedValue(analysis);
});
describe("guardado revisado", () => {
  it("nunca guarda al analizar y reintenta solo las filas que fallaron", async () => {
    api.importBackendRows
      .mockResolvedValueOnce({
        imported: 1,
        updated: 0,
        errors: [{ row: 2, message: "No se pudo guardar" }],
      })
      .mockResolvedValueOnce({ imported: 1, updated: 0, errors: [] });
    const finish = vi.fn();
    render(<StockOnboarding onFinish={finish} />);
    fireEvent.click(screen.getByRole("button", { name: "Pegar mi lista" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Listado de equipos" }),
      { target: { value: "listado" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Analizar mi lista" }));
    await screen.findByRole("button", {
      name: "Guardar 2 equipos e ir al inventario",
    });
    expect(api.importBackendRows).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Guardar 2 equipos e ir al inventario",
      }),
    );
    await screen.findByRole("alert");
    expect(finish).not.toHaveBeenCalled();
    expect(context.updateGettingStarted).not.toHaveBeenCalled();
    expect(screen.getByTestId("onboarding-equipment-count")).toHaveTextContent(
      "1",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Guardar 1 equipo e ir al inventario",
      }),
    );
    await waitFor(() => expect(finish).toHaveBeenCalledWith("inventory"));
    expect(api.importBackendRows.mock.calls[1][2]).toHaveLength(1);
    expect(api.importBackendRows.mock.calls[1][2][0].model).toBe("iPhone 14");
  });
  it("muestra la lectura y los equipos antes del resultado, nunca un cero trabado", async () => {
    let continueAnalysis: () => Promise<void> = async () => undefined;
    api.analyzeInventoryTextProgress.mockImplementation(
      (_user, _text, onProgress) =>
        new Promise((resolve) => {
          continueAnalysis = async () => {
            await onProgress?.([{ model: "iPhone 13", quantity: 2 }]);
            resolve(analysis);
          };
        }),
    );
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pegar mi lista" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Listado de equipos" }),
      { target: { value: "iPhone 13" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Analizar mi lista" }));
    expect(
      await screen.findByTestId("onboarding-analyze-status"),
    ).toHaveTextContent("Leyendo 1 línea");
    expect(screen.queryByText(/0 equipos reconocidos/)).toBeNull();
    const pending = continueAnalysis();
    expect(
      await screen.findByTestId("onboarding-analyze-status"),
    ).toHaveTextContent("2 equipos reconocidos");
    expect(screen.getByText(/iPhone 13/)).toBeVisible();
    expect(api.importBackendRows).not.toHaveBeenCalled();
    await pending;
    await screen.findByRole("button", {
      name: "Guardar 2 equipos e ir al inventario",
    });
  });
  it("no suma al total en dólares una fila sin moneda", async () => {
    api.analyzeInventoryTextProgress.mockResolvedValue({
      ...analysis,
      rows: [
        analysis.rows[0],
        {
          model: "Libre",
          price: "100",
          currency: "",
          condition: "USADO",
          quantity: "1",
        },
      ],
      review: [
        { line: 1, original: "13", dudas: [] },
        {
          line: 2,
          original: "libre",
          dudas: ["Sin moneda: elegí ARS o USD antes de importar."],
        },
      ],
    });
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pegar mi lista" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Listado de equipos" }),
      { target: { value: "iPhone 13\nlibre" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Analizar mi lista" }));
    expect(await screen.findByTestId("onboarding-stock-usd")).toHaveTextContent(
      "US$ 420",
    );
    expect(screen.getByTestId("onboarding-without-currency")).toHaveTextContent(
      "1 equipo sin moneda no entra en el total",
    );
    expect(screen.getByRole("button", { name: /Libre/ })).toHaveTextContent(
      "Sin moneda",
    );
  });
  it("ofrece datos de ejemplo también con el onboarding ya completado", () => {
    context.appSession.store = {
      ...context.appSession.store,
      onboardingCompletedAt: "2026-10-14",
    };
    render(<StockOnboarding onFinish={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Probar con datos de ejemplo/ }),
    ).toBeVisible();
  });
});
