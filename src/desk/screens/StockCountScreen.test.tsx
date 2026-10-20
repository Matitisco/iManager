import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlindCount, ClosedStockCount, StockCountListItem, StockCountPreview } from '../../services/stock-counts-api';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';
import { StockCountScreen } from './StockCountScreen';

const toast = vi.fn();
const reloadInventory = vi.fn(async () => undefined);
const user = { uid: 'owner-1' };

const context = vi.hoisted(() => ({
  inventory: [] as never[],
  operationDrafts: [] as never[],
  operationNotifications: [] as never[],
  listsLoaded: true,
  user: { uid: 'owner-1' } as { uid: string } | null,
  appSession: {
    store: { name: 'Tienda Ejemplo' },
    membership: { role: 'OWNER', sections: null as string[] | null },
  } as { store?: { name?: string }; membership?: { role?: string; sections?: string[] | null } } | null,
  reloadInventory: vi.fn(async () => undefined),
}));

const api = vi.hoisted(() => ({
  fetchStockCounts: vi.fn(),
  fetchStockCountPreview: vi.fn(),
  fetchCurrentStockCount: vi.fn(),
  fetchStockCount: vi.fn(),
  startStockCount: vi.fn(),
  scanStockCount: vi.fn(),
  closeStockCount: vi.fn(),
  resolveStockCount: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/stock-counts-api', () => api);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function desk(node: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
      {node}
    </DeskProvider>,
  );
}

function phone() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: String(query).includes('760'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function desktop() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const blind: BlindCount & { missing?: unknown; expectedCount?: number } = {
  id: 'count-1',
  subtitle: 'Abierto por Matías · hoy 09:10 · contando Lucía y Tomás',
  mine: 1,
  total: 1,
  expectedCount: 48,
  missing: [{ model: 'iPhone secreto' }],
  scans: [{
    id: 'scan-1',
    createdAt: '2026-10-19T12:42:00.000Z',
    result: 'FOUND',
    imei: '352098117744521',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Medianoche',
  }],
};

const closed: ClosedStockCount = {
  id: 'count-1',
  status: 'CLOSED',
  resolution: null,
  subtitle: 'Cerrado hoy 11:05 · contaron Lucía y Tomás · 49 escaneos',
  summary: '1 coinciden · 1 faltan · 1 sobran · 1 figura vendido',
  startedAt: '2026-10-19T12:10:00.000Z',
  closedAt: '2026-10-19T14:05:00.000Z',
  excludedNoImei: 3,
  scanCount: 49,
  buckets: {
    matched: [{ key: 'ok', inventoryItemId: 'ok', imei: '352098117744521', model: 'iPhone 13', capacity: '128GB', color: 'Medianoche', price: 850000, currency: 'ARS', note: null }],
    missing: [{ key: 'miss', inventoryItemId: 'miss-1', imei: '352098117741188', model: 'iPhone 13 mini', capacity: '128GB', color: 'Rosa', price: 560000, currency: 'ARS', note: null }],
    surplus: [{ key: 'extra', inventoryItemId: null, imei: '352098117747702', model: '', capacity: '', color: '', price: null, currency: null, note: 'No está cargado' }],
    sold: [{ key: 'sold', inventoryItemId: 'sold-1', imei: '352098117746612', model: 'iPhone 11', capacity: '128GB', color: 'Negro', price: 330000, currency: 'ARS', note: 'Se vendió durante el conteo' }],
  },
};

const listed: StockCountListItem = {
  id: closed.id,
  status: 'CLOSED',
  resolution: null,
  subtitle: 'Cerrado hoy 11:05 · contaron Lucía y Tomás',
  summary: closed.summary,
  startedAt: closed.startedAt,
  closedAt: closed.closedAt,
};

beforeEach(() => {
  desktop();
  context.user = user;
  context.appSession = { store: { name: 'Tienda Ejemplo' }, membership: { role: 'OWNER', sections: null } };
  context.reloadInventory = reloadInventory;
  reloadInventory.mockClear();
  toast.mockClear();
  api.fetchStockCounts.mockResolvedValue([]);
  api.fetchCurrentStockCount.mockResolvedValue(null);
  api.fetchStockCountPreview.mockResolvedValue({ excludedNoImei: 3, scope: 'Disponibles, reservados y en revisión', counters: 'Todo el equipo con Inventario' } satisfies StockCountPreview);
  api.fetchStockCount.mockResolvedValue(closed);
  api.startStockCount.mockResolvedValue(blind);
  api.scanStockCount.mockResolvedValue({
    ...blind,
    mine: 2,
    total: 2,
    scans: [{
      id: 'scan-2',
      createdAt: '2026-10-19T12:43:00.000Z',
      result: 'REPEATED',
      imei: '352098117744521',
      model: 'iPhone 13',
      capacity: '128GB',
      color: 'Medianoche',
    }, ...blind.scans],
  });
  api.closeStockCount.mockResolvedValue(closed);
  api.resolveStockCount.mockImplementation(async (_user, _id, body: { mode: string }) => ({
    ...closed,
    resolution: body.mode === 'ADJUST' ? 'ADJUSTED' : 'RECORDED',
  }));
});

describe('control de stock', () => {
  it('espera con un esqueleto y después muestra el vacío', async () => {
    const list = deferred<StockCountListItem[]>();
    const current = deferred<BlindCount | null>();
    api.fetchStockCounts.mockReturnValue(list.promise);
    api.fetchCurrentStockCount.mockReturnValue(current.promise);
    desk(<StockCountScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('stock-loading')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hiciste controles de stock')).not.toBeInTheDocument();
    list.resolve([]);
    current.resolve(null);
    expect(await screen.findByTestId('stock-empty')).toHaveTextContent('Todavía no hiciste controles de stock');
    expect(screen.getByRole('button', { name: 'Iniciar control' })).toBeInTheDocument();
  });

  it('abre el inicio sin la cantidad esperada y con accesorios desactivados', async () => {
    const preview = deferred<StockCountPreview>();
    api.fetchStockCountPreview.mockReturnValue(preview.promise);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: 'Iniciar control' }));
    const dialog = await screen.findByRole('dialog', { name: 'Iniciar control de stock' });
    expect(within(dialog).getByRole('button', { name: 'Accesorios · más adelante' })).toBeDisabled();
    expect(within(dialog).getByText('Disponibles, reservados y en revisión')).toBeInTheDocument();
    expect(dialog.querySelector('.stock-sk')).toBeTruthy();
    expect(dialog).not.toHaveTextContent(/\d+ equipos/);
    expect(dialog).not.toHaveTextContent('Faltan');
    expect(dialog).not.toHaveTextContent('iPhone');
    preview.resolve({ excludedNoImei: 3, scope: 'Disponibles, reservados y en revisión', counters: 'Todo el equipo con Inventario' });
    expect(await within(dialog).findByText('3 equipos')).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent('Faltan');
  });

  it('deja escanear al empleado y le oculta iniciar, cerrar y ajustar', async () => {
    context.appSession = { membership: { role: 'STAFF', sections: ['inventory'] } };
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    desk(<StockCountScreen onBack={vi.fn()} />);
    expect(await screen.findByTestId('stock-scan-input')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajustar al conteo' })).not.toBeInTheDocument();
    expect(screen.getByText('1 tuyo · 1 en total')).toBeInTheDocument();
    expect(screen.queryByText('Faltan')).not.toBeInTheDocument();
    expect(screen.queryByText('iPhone secreto')).not.toBeInTheDocument();
    expect(screen.queryByText('48')).not.toBeInTheDocument();
  });

  it('suma el IMEI con Enter y deja el foco en el campo', async () => {
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    const input = await screen.findByTestId('stock-scan-input');
    await actor.type(input, '352098117744521');
    await actor.keyboard('{Enter}');
    await waitFor(() => expect(api.scanStockCount).toHaveBeenCalledWith(user, 'count-1', '352098117744521'));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(input).toHaveFocus();
    expect(screen.getByText('Repetido')).toBeInTheDocument();
    expect(screen.getByText('2 tuyos · 2 en total')).toBeInTheDocument();
    expect(screen.queryByText('Faltan')).not.toBeInTheDocument();
  });

  it('extrae el IMEI de una etiqueta de caja', async () => {
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    const input = await screen.findByTestId('stock-scan-input');
    await actor.type(input, 'MLPF3LE/A F2LXK9POQ1 351204883022116');
    await actor.keyboard('{Enter}');
    await waitFor(() => expect(api.scanStockCount).toHaveBeenCalledWith(user, 'count-1', '351204883022116'));
  });

  it('en el teléfono el empleado tampoco ve cerrar', async () => {
    phone();
    context.appSession = { membership: { role: 'STAFF', sections: ['inventory'] } };
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    desk(<StockCountScreen onBack={vi.fn()} />);
    expect(await screen.findByTestId('stock-scan-input')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-close')).not.toBeInTheDocument();
  });

  it('ajusta los faltantes y sobrantes elegidos, o solo deja registrado', async () => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    expect(await screen.findByText('Coinciden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Faltan 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'iPhone 13 mini 128GB' })).toBeChecked();
    await actor.click(screen.getByRole('button', { name: 'Figuran vendidos 1' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Se vendió durante el conteo/)).toBeInTheDocument();
    await actor.click(screen.getByTestId('stock-record'));
    await waitFor(() => expect(api.resolveStockCount).toHaveBeenCalledWith(user, 'count-1', {
      mode: 'RECORD',
      missingIds: [],
      surplusImeis: [],
    }));
    expect(reloadInventory).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Quedó registrado, sin cambiar el inventario.');
  });

  it('archiva los faltantes elegidos y carga los sobrantes al ajustar', async () => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    await screen.findByTestId('stock-adjust');
    await actor.click(screen.getByTestId('stock-adjust'));
    await waitFor(() => expect(api.resolveStockCount).toHaveBeenCalledWith(user, 'count-1', {
      mode: 'ADJUST',
      missingIds: ['miss-1'],
      surplusImeis: ['352098117747702'],
    }));
    expect(reloadInventory).toHaveBeenCalled();
  });

  it('un socio sin Inventario no inicia el control', async () => {
    context.appSession = { membership: { role: 'MANAGER', sections: ['sales'] } };
    desk(<StockCountScreen onBack={vi.fn()} />);
    expect(await screen.findByTestId('stock-empty')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar control' })).not.toBeInTheDocument();
  });

  it('entra desde Inventario y vuelve con la flecha', async () => {
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<InventoryScreen />);
    await actor.click(screen.getByTestId('stock-count-entry'));
    expect(await screen.findByTestId('stock-count-page')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Equipo/ })).not.toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
  });
});
