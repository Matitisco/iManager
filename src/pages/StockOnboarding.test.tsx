import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockOnboarding } from "./StockOnboarding";
import type { CustomFieldInput } from '../services/custom-fields-api';
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
  inventory: [] as Array<{ id: string }>,
  reloadInventory: vi.fn(async () => undefined),
  reloadSession: vi.fn(async () => undefined),
  finishStockOnboarding: vi.fn(),
  refreshGettingStarted: vi.fn(async () => undefined),
}));
const analytics = vi.hoisted(() => ({ track: vi.fn(), rowBucket: (n: number) => n <= 1 ? '1' : '2-10' }));
const samples = vi.hoisted(() => ({ createSampleStock: vi.fn(async () => undefined) }));
const posthog = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('../lib/posthog-analytics', () => posthog);
vi.mock('../lib/analytics', () => analytics);
vi.mock('../services/getting-started-api', () => samples);
const api = vi.hoisted(() => ({
  analyzeImport: vi.fn(),
  applyImportPlan: vi.fn(),
  analyzeInventoryText: vi.fn(),
  analyzeInventoryTextProgress: vi.fn(),
  importBackendRows: vi.fn(),
}));
vi.mock("../context/AppContext", () => ({ useAppContext: () => context }));
vi.mock("../desk/exchange", () => ({
  ExchangeProvider: ({ children }: { children: React.ReactNode }) => children,
  exchangeFromStore: () => ({}),
  useMoney: () => ({ rate: 1300 }),
}));
vi.mock("../desk/DeskOverlays", async () => {
  const { useDesk } = await import('../desk/ui');
  return { DeskOverlays: ({ onSaved }: { onSaved?: () => void }) => {
    const desk = useDesk();
    return <><button onClick={() => { onSaved?.(); desk.close(); }}>Guardar manual</button><button onClick={desk.close}>Cancelar manual</button></>;
  } };
});
vi.mock("../components/ImportModal", () => ({ ImportModal: ({ onImport, onClose, onStageChange }: { onImport: (rows: Record<string, string>[], definitions?: CustomFieldInput[]) => Promise<unknown>; onClose: () => void; onStageChange?: (at: 'mapping') => void }) => <><button onClick={() => { void onImport([{ model: 'Equipo' }]); }}>Importar prueba</button><button onClick={() => { void onImport([{ model: 'Equipo', 'custom:calidad_origen': 'AB+' }], [{ entity: 'inventory', key: 'calidad_origen', label: 'Calidad (origen)', type: 'text', order: 0 }]); }}>Importar calidad</button><button onClick={onClose}>Cancelar Excel</button><button onClick={() => onStageChange?.('mapping')}>Mapear prueba</button></> }));
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
  context.reloadInventory.mockResolvedValue(undefined);
  samples.createSampleStock.mockResolvedValue(undefined);
  context.inventory = [];
  context.appSession.store = {
    name: "Casa",
    currency: "USD",
    onboardingStartedAt: "2026-10-14",
    onboardingCompletedAt: undefined,
  };
  api.analyzeInventoryTextProgress.mockResolvedValue(analysis);
});
describe("guardado revisado", () => {
  it('envía definiciones y valores personalizados al confirmar Excel en tienda vacía', async () => {
    api.importBackendRows.mockResolvedValue({ imported: 1, updated: 0, errors: [] });
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar calidad' }));
    await waitFor(() => expect(api.importBackendRows).toHaveBeenCalledWith(
      context.user, 'inventory',
      [expect.objectContaining({ model: 'Equipo', customFields: { calidad_origen: 'AB+' } })],
      undefined, 'excel',
      [{ entity: 'inventory', key: 'calidad_origen', label: 'Calidad (origen)', type: 'text', order: 0 }],
    ));
  });

  it("ofrece Excel primero en el segundo y último paso, sin invitación", () => {
    render(<StockOnboarding onFinish={vi.fn()} />);
    expect(screen.getByText("Paso 2 de 2")).toBeVisible();
    expect(screen.getAllByRole("button").slice(0, 3).map((button) => button.textContent?.trim())).toEqual(["Subir Excel", "Pegar lista", "A mano"]);
    expect(screen.getByText("Y ves cuánto vale tu stock.")).toBeVisible();
    expect(screen.queryByText("Mejor con tu equipo")).toBeNull();
  });

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
    fireEvent.click(screen.getByRole("button", { name: "Pegar lista" }));
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
    expect(context.finishStockOnboarding).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Pegar lista" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Pegar lista" }));
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

describe('instrumentación invisible de Stock', () => {
  it.each([
    ['Subir Excel', 'excel'], ['Pegar lista', 'paste'], ['A mano', 'manual'],
    ['Probar con datos de ejemplo', 'sample'], ['Saltar por ahora', 'skip'], ['Ir a mi inventario', 'go_inventory'],
  ])('emite el método %s', async (label, method) => {
    if (method === 'go_inventory') context.inventory = [{ id: 'real' }];
    render(<StockOnboarding onFinish={vi.fn()} />);
    expect(analytics.track).toHaveBeenCalledWith('onboarding_stock_viewed');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
    expect(analytics.track).toHaveBeenCalledWith('stock_method_chosen', { method });
    if (method === 'skip') await waitFor(() => expect(context.finishStockOnboarding).toHaveBeenCalledWith('skip'));
  });
  it('registra el cierre de Excel y el paso donde se abandonó', () => {
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mapear prueba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Excel' }));
    expect(analytics.track).toHaveBeenCalledWith('stock_import_abandoned', { method: 'excel', at: 'mapping' });
  });
  it('distingue el alta manual de una cancelación sin alta', () => {
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'A mano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar manual' }));
    expect(analytics.track).toHaveBeenCalledWith('stock_import_finished', { method: 'manual', ok: true, rows: '1', errors: 0 });
    expect(analytics.track).not.toHaveBeenCalledWith('stock_import_abandoned', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'A mano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar manual' }));
    expect(analytics.track).toHaveBeenCalledWith('stock_import_abandoned', { method: 'manual' });
  });
  it('registra un Excel guardado y completa por import sin abandono', async () => {
    api.importBackendRows.mockResolvedValue({ imported: 1, updated: 0, errors: [] });
    const finish = vi.fn(); render(<StockOnboarding onFinish={finish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar prueba' }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('inventory'));
    expect(analytics.track).toHaveBeenCalledWith('stock_import_finished', { method: 'excel', ok: true, rows: '1', errors: 0 });
    expect(context.finishStockOnboarding).toHaveBeenCalledWith('import');
  });
  it('registra Volver desde pegar como abandono sin enviar el texto', () => {
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pegar lista' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Listado de equipos' }), { target: { value: 'Texto privado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(analytics.track).toHaveBeenCalledWith('stock_import_abandoned', { method: 'paste', at: 'file' });
    expect(JSON.stringify(analytics.track.mock.calls)).not.toContain('Texto privado');
  });
});


describe('salida resiliente de stock', () => {
  it('sale sin esperar una recarga de inventario que falla', async () => {
    context.reloadInventory.mockRejectedValue(new Error('offline'));
    const finish = vi.fn();
    render(<StockOnboarding onFinish={finish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('dashboard'));
    expect(context.finishStockOnboarding).toHaveBeenCalledWith('skip');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('no espera una lectura de inventario que sigue pendiente', async () => {
    context.reloadInventory.mockReturnValue(new Promise(() => {}));
    const finish = vi.fn();
    render(<StockOnboarding onFinish={finish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('dashboard'));
  });
  it('no presenta ejemplos fallidos como cargados y todavía permite saltar', async () => {
    samples.createSampleStock.mockRejectedValue(new Error('No se pudieron cargar los ejemplos.'));
    const finish = vi.fn();
    render(<StockOnboarding onFinish={finish} />);
    fireEvent.click(screen.getByRole('button', { name: /Probar con datos de ejemplo/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los ejemplos.');
    expect(finish).not.toHaveBeenCalled();
    expect(context.finishStockOnboarding).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('dashboard'));
  });
  it('no repite un Excel ya guardado si falla su recarga', async () => {
    api.importBackendRows.mockResolvedValue({ imported: 1, updated: 0, errors: [] });
    context.reloadInventory.mockRejectedValue(new Error('offline'));
    const finish = vi.fn();
    render(<StockOnboarding onFinish={finish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar prueba' }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith('inventory'));
    expect(api.importBackendRows).toHaveBeenCalledTimes(1);
  });
});

describe('PostHog onboarding completion', () => {
  it('reports skipping stock without payload data', async () => {
    render(<StockOnboarding onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
    await waitFor(() => expect(posthog.capture).toHaveBeenCalledExactlyOnceWith('onboarding_step_skipped', { step: 'stock' }));
  });
});
