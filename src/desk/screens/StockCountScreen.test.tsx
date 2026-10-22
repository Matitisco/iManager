import type { ReactNode } from 'react';
import type { Product } from '../../types';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlindCount, ClosedStockCount, StockCountListItem, StockCountPreview } from '../../services/stock-counts-api';
import { DeskProvider } from '../ui';
import { StockCountScreen } from './StockCountScreen';

const toast = vi.fn();
const reloadInventory = vi.fn(async () => undefined);
const user = { uid: 'owner-1' };

const context = vi.hoisted(() => ({
  inventory: [] as Product[],
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
vi.mock('../scan/use-camera', () => ({ useCameraAvailable: () => true }));
vi.mock('../scan/CameraScanner', () => ({ CameraScanner: ({ onUse, onManual }: { onUse: (value: { imei: string }) => void; onManual: () => void }) => (
  <div role="dialog" aria-label="Cámara"><button onClick={() => onUse({ imei: '352098117744521' })}>Usar IMEI</button><button onClick={onManual}>Ingreso manual</button></div>
) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function desk(node: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'stockCount', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
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
  summary: '1 coinciden · 1 sin escanear · 1 sin cargar · 1 figura vendido',
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
  Object.values(api).forEach((mock) => mock.mockReset());
  desktop();
  context.user = user;
  context.inventory = [];
  context.appSession = { store: { name: 'Tienda Ejemplo' }, membership: { role: 'OWNER', sections: null } };
  context.reloadInventory = reloadInventory;
  reloadInventory.mockClear();
  toast.mockClear();
  api.fetchStockCounts.mockResolvedValue([]);
  api.fetchCurrentStockCount.mockResolvedValue(null);
  api.fetchStockCountPreview.mockResolvedValue({ excludedNoImei: 3, scope: 'Disponible', counters: 'Todo el equipo con Inventario' } satisfies StockCountPreview);
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

describe('control de stock #318', () => {
  const actor = () => userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const result = async () => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    desk(<StockCountScreen />);
    return screen.findByRole('region', { name: 'Resultado del conteo' });
  };

  it.each([false, true])('expande todos los equipos y vuelve a la vista compacta al cambiar de grupo (móvil: %s)', async (mobile) => {
    if (mobile) phone();
    const missing = Array.from({ length: 8 }, (_, index) => ({ ...closed.buckets.missing[0], key: `line-${index}`, model: `Equipo ${index}` }));
    api.fetchStockCount.mockResolvedValue({ ...closed, buckets: { ...closed.buckets, missing } });
    const act = actor();
    await result();
    expect(screen.queryByText(`Equipo ${mobile ? 4 : 5} · 128GB`)).not.toBeInTheDocument();
    await act.click(screen.getByRole('button', { name: 'Ver los 8' }));
    expect(screen.getByText('Equipo 7 · 128GB')).toBeInTheDocument();
    await act.click(screen.getByRole('button', { name: 'Coinciden 1' }));
    await act.click(screen.getByRole('button', { name: 'Sin escanear 8' }));
    expect(screen.queryByText('Equipo 7 · 128GB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver los 8' })).toHaveAttribute('aria-expanded', 'false');
    const steps = screen.getByRole('list', { name: 'Pasos del control' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getByText('Revisar').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText('Conteos físicos del local')).not.toBeInTheDocument();
  });

  it('presenta el alcance con el inventario cargado sin incluir vendidos, archivados o equipos sin IMEI', async () => {
    const product: Product = { id: 'eq', imei: '352098117744521', model: 'iPhone', capacity: '128GB', color: 'Negro', condition: 'Usado', grade: 'A', batteryHealth: '90%', price: 1, status: 'DISPONIBLE' };
    context.inventory = [product, { ...product, id: 'sold', status: 'VENDIDO' }, { ...product, id: 'reserved', status: 'RESERVADO' }, { ...product, id: 'archived', archivedAt: '2026-10-20' }, { ...product, id: 'without-imei', imei: '' }];
    const act = actor();
    desk(<StockCountScreen />);
    await act.click(await screen.findByRole('button', { name: 'Iniciar control' }));
    expect(await within(screen.getByRole('dialog')).findByText('Disponibles · 1')).toBeInTheDocument();
    expect(api.startStockCount).not.toHaveBeenCalled();
  });

  it('espera con un esqueleto y después muestra el vacío', async () => {
    const list = deferred<StockCountListItem[]>();
    api.fetchStockCounts.mockReturnValue(list.promise);
    desk(<StockCountScreen />);
    expect(screen.getByTestId('stock-loading')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hiciste controles de stock')).not.toBeInTheDocument();
    list.resolve([]);
    expect(await screen.findByTestId('stock-empty')).toBeInTheDocument();
  });

  it.each([false, true])('presenta el alcance al iniciar y conserva el conteo a ciegas (móvil: %s)', async (mobile) => {
    if (mobile) phone();
    const preview = deferred<StockCountPreview>();
    api.fetchStockCountPreview.mockReturnValue(preview.promise);
    const act = actor();
    desk(<StockCountScreen />);
    await act.click(await screen.findByRole('button', { name: 'Iniciar control' }));
    const dialog = screen.getByRole('dialog', { name: 'Iniciar control' });
    expect(dialog).toHaveClass('stock-start-sheet');
    expect(within(dialog).getByText('Comparar con')).toBeInTheDocument();
    expect(within(dialog).getByText('Conteo a ciegas')).toBeInTheDocument();
    expect(within(dialog).getByTestId('stock-preview-loading')).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/Accesorios|Quiénes cuentan|reservados|en revisión|Faltan|iPhone|Cargando…/);
    preview.resolve({ excludedNoImei: 3, scope: 'Disponible', counters: 'Todo el equipo con Inventario' });
    expect(await within(dialog).findByText('3 equipos sin IMEI quedan fuera.')).toBeInTheDocument();
    expect(within(dialog).getByText('Disponibles · 0')).toBeInTheDocument();
    await act.click(within(dialog).getByRole('button', { name: 'Iniciar conteo' }));
    expect(await screen.findByTestId('stock-scan-input')).toBeInTheDocument();
    expect(api.startStockCount).toHaveBeenCalledWith(user);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('48')).not.toBeInTheDocument();
    expect(screen.queryByText('iPhone secreto')).not.toBeInTheDocument();
  });

  it('conserva el modal y muestra el error si no se puede iniciar', async () => {
    api.startStockCount.mockRejectedValue(new Error('No se pudo iniciar (503)'));
    const act = actor();
    desk(<StockCountScreen />);
    await act.click(await screen.findByRole('button', { name: 'Iniciar control' }));
    const dialog = screen.getByRole('dialog');
    await act.click(within(dialog).getByRole('button', { name: 'Iniciar conteo' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('503');
    expect(dialog).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([false, true])('continúa el abierto y mantiene el conteo a ciegas (móvil: %s)', async (mobile) => {
    if (mobile) phone();
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    api.fetchStockCounts.mockResolvedValue([listed]);
    context.appSession = { membership: { role: 'STAFF', sections: ['inventory'] } };
    desk(<StockCountScreen />);
    expect(await screen.findByTestId('stock-scan-input')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Control de stock' })).toBeInTheDocument();
    expect(document.querySelector('.dtop .dsub')).not.toBeInTheDocument();
    expect(screen.queryByText(blind.subtitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar control' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajustar al conteo' })).not.toBeInTheDocument();
    expect(screen.getByText('1 tuyo · 1 en total')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-close')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar control' })).not.toBeInTheDocument();
    expect(screen.queryByText('iPhone secreto')).not.toBeInTheDocument();
    expect(screen.queryByText('48')).not.toBeInTheDocument();
    expect(api.fetchStockCount).not.toHaveBeenCalled();
  });

  it.each(['352098117744521', 'MLPF3LE/A F2LXK9POQ1 351204883022116'])('suma con Enter desde lector o ingreso manual: %s', async (raw) => {
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    const act = actor();
    desk(<StockCountScreen />);
    const input = await screen.findByTestId('stock-scan-input');
    await act.type(input, raw);
    await act.keyboard('{Enter}');
    await waitFor(() => expect(api.scanStockCount).toHaveBeenCalledWith(user, 'count-1', raw.includes('MLPF') ? '351204883022116' : raw));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(input).toHaveFocus();
    expect(screen.getByText('Repetido')).toBeInTheDocument();
  });

  it('mantiene cámara y regreso al ingreso manual', async () => {
    api.fetchCurrentStockCount.mockResolvedValue(blind);
    const act = actor();
    desk(<StockCountScreen />);
    const input = await screen.findByTestId('stock-scan-input');
    await act.click(screen.getByRole('button', { name: 'Escanear con la cámara' }));
    await act.click(screen.getByRole('button', { name: 'Ingreso manual' }));
    expect(input).toHaveFocus();
    await act.click(screen.getByRole('button', { name: 'Escanear con la cámara' }));
    await act.click(screen.getByRole('button', { name: 'Usar IMEI' }));
    await waitFor(() => expect(api.scanStockCount).toHaveBeenCalledWith(user, 'count-1', '352098117744521'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre el resultado reciente por revisar con grupos e IMEI completo, sin ajustes', async () => {
    const act = actor();
    const summary = await result();
    expect(summary).toHaveTextContent('Conteo del 19 de octubre');
    expect(summary).toHaveTextContent('Por revisar');
    expect(summary).toHaveTextContent('Comparado con Disponibles');
    expect(screen.getByTestId('stock-excluded')).toHaveTextContent('3 sin IMEI fuera del conteo');
    expect(screen.getByRole('button', { name: 'Sin escanear 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('iPhone 13 mini · 128GB')).toBeInTheDocument();
    expect(screen.getByText('IMEI 352098117741188')).toBeInTheDocument();
    for (const [name, imei] of [['Sin cargar 1', '352098117747702'], ['Figuran vendidos 1', '352098117746612'], ['Coinciden 1', '352098117744521']]) {
      await act.click(screen.getByRole('button', { name }));
      expect(screen.getByText(`IMEI ${imei}`)).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('stock-adjust')).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('stock-record')).toHaveTextContent('Registrar conteo');
    expect(screen.queryByText(/Archivar|Cargar equipo|Solo dejar registrado|Faltan|Sobran/)).not.toBeInTheDocument();
  });

  it.each([false, true])('registra con RECORD y evita doble envío sin mutar inventario (móvil: %s)', async (mobile) => {
    if (mobile) phone();
    const pending = deferred<ClosedStockCount>();
    api.resolveStockCount.mockReturnValue(pending.promise);
    const act = actor();
    await result();
    await act.dblClick(screen.getByTestId('stock-record'));
    expect(api.resolveStockCount).toHaveBeenCalledTimes(1);
    expect(api.resolveStockCount).toHaveBeenCalledWith(user, 'count-1', { mode: 'RECORD', missingIds: [], surplusImeis: [] });
    expect(screen.getByTestId('stock-record')).toBeDisabled();
    pending.resolve({ ...closed, resolution: 'RECORDED' });
    await waitFor(() => expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument());
    expect(screen.getByText('Registrado')).toBeInTheDocument();
    expect(reloadInventory).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Quedó registrado, sin cambiar el inventario.');
    expect(screen.getByTestId('stock-excluded')).toHaveTextContent('Comparado con Disponibles');
    if (mobile) expect(screen.getByTestId('stock-count-page')).toHaveClass('has-dock');
  });

  it('muestra el fallo al registrar y permite reintentar', async () => {
    api.resolveStockCount.mockRejectedValueOnce(new Error('No se pudo guardar (503)'));
    const act = actor();
    await result();
    await act.click(screen.getByTestId('stock-record'));
    expect(await screen.findByRole('alert')).toHaveTextContent('503');
    expect(screen.getByText('Por revisar')).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
    await act.click(screen.getByTestId('stock-record'));
    await waitFor(() => expect(screen.getByText('Registrado')).toBeInTheDocument());
    expect(reloadInventory).not.toHaveBeenCalled();
  });

  it('cierra sin escaneos y nunca presenta pérdidas confirmadas', async () => {
    api.fetchCurrentStockCount.mockResolvedValue({ ...blind, total: 0, mine: 0, scans: [] });
    api.closeStockCount.mockResolvedValue({ ...closed, scanCount: 0 });
    const act = actor();
    desk(<StockCountScreen />);
    await act.click(await screen.findByTestId('stock-close'));
    expect(await screen.findByTestId('stock-coverage')).toHaveTextContent('Sin escaneos');
    expect(screen.getByTestId('stock-coverage')).toHaveTextContent('no confirman pérdidas');
    expect(screen.getByRole('button', { name: 'Sin escanear 1' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Faltan|Faltantes/)).not.toBeInTheDocument();
    expect(api.resolveStockCount).not.toHaveBeenCalled();
  });

  it.each(['STAFF', 'MANAGER'])('mantiene solo lectura para %s sin permisos de gestión', async (role) => {
    context.appSession = { membership: { role, sections: role === 'STAFF' ? ['inventory'] : ['sales'] } };
    await result();
    expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar control' })).not.toBeInTheDocument();
  });

  it.each(['ADJUSTED', 'RECORDED'] as const)('conserva históricos %s en solo lectura', async (resolution) => {
    api.fetchStockCount.mockResolvedValue({ ...closed, resolution });
    await result();
    expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument();
    expect(screen.getByText(resolution === 'ADJUSTED' ? 'Ajustado' : 'Registrado')).toBeInTheDocument();
  });

  it('muestra controles anteriores y permite revisarlos', async () => {
    const older = { ...listed, id: 'old', resolution: 'RECORDED' as const, startedAt: '2026-10-07T22:10:00Z', closedAt: '2026-10-07T22:10:00Z' };
    api.fetchStockCounts.mockResolvedValue([listed, older]);
    api.fetchStockCount.mockImplementation(async (_user, id) => ({ ...closed, id, resolution: id === 'old' ? 'RECORDED' : null }));
    const act = actor();
    desk(<StockCountScreen />);
    const history = await screen.findByTestId('stock-history');
    expect(within(history).getAllByRole('button')).toHaveLength(1);
    await act.click(within(history).getByRole('button'));
    await waitFor(() => expect(api.fetchStockCount).toHaveBeenLastCalledWith(user, 'old'));
    await waitFor(() => expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument());
    expect(within(screen.getByRole('region', { name: 'Resultado del conteo' })).getByText('Registrado')).toBeInTheDocument();
  });

  it('muestra un error si no puede abrir el último resultado', async () => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    api.fetchStockCount.mockRejectedValue(new Error('No se pudo abrir (503)'));
    desk(<StockCountScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('503');
    expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
