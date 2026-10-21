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

  it('abre sin selección y permite registrar sin cambiar inventario incluso con selección', async () => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    expect(await screen.findByText('Coinciden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Faltan 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: /iPhone 13 mini 128GB/ })).not.toBeChecked();
    expect(screen.getByTestId('stock-adjust')).toBeDisabled();
    await actor.click(screen.getByRole('checkbox', { name: /iPhone 13 mini 128GB/ }));
    expect(screen.getByTestId('stock-adjust')).toHaveTextContent('Archivar 1 equipo seleccionado');
    await actor.click(screen.getByRole('button', { name: 'Figuran vendidos 1' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Se vendió durante el conteo/)).toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Faltan 1' }));
    await actor.click(screen.getByRole('checkbox', { name: /iPhone 13 mini 128GB/ }));
    await actor.click(screen.getByTestId('stock-record'));
    await waitFor(() => expect(api.resolveStockCount).toHaveBeenCalledWith(user, 'count-1', {
      mode: 'RECORD',
      missingIds: [],
      surplusImeis: [],
    }));
    expect(reloadInventory).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Quedó registrado, sin cambiar el inventario.');
  });

  it.each([false, true])('confirma solo los faltantes explícitos, permite cancelar y bloquea doble envío (móvil: %s)', async (mobile) => {
    if (mobile) phone();
    const pending = deferred<ClosedStockCount>();
    api.resolveStockCount.mockReturnValue(pending.promise);
    api.fetchStockCounts.mockResolvedValue([listed]);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    await actor.click(await screen.findByRole('checkbox', { name: /iPhone 13 mini 128GB/ }));
    await actor.click(screen.getByTestId('stock-adjust'));
    let dialog = await screen.findByRole('dialog', { name: 'Archivar 1 equipo seleccionado' });
    expect(dialog).toHaveTextContent('Motivo de archivo');
    expect(dialog).toHaveTextContent('Faltante');
    expect(dialog).toHaveTextContent('352098117741188');
    expect(dialog).toHaveTextContent('Los demás equipos no se modificarán');
    expect(api.resolveStockCount).not.toHaveBeenCalled();
    await actor.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.resolveStockCount).not.toHaveBeenCalled();
    expect(reloadInventory).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /iPhone 13 mini/ })).toBeChecked();
    await actor.click(screen.getByTestId('stock-adjust'));
    dialog = await screen.findByRole('dialog');
    await actor.dblClick(within(dialog).getByRole('button', { name: 'Archivar 1 equipo seleccionado' }));
    await waitFor(() => expect(api.resolveStockCount).toHaveBeenCalledWith(user, 'count-1', {
      mode: 'ADJUST',
      missingIds: ['miss-1'],
      surplusImeis: [],
    }));
    expect(api.resolveStockCount).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    await actor.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    pending.resolve({ ...closed, resolution: 'ADJUSTED' });
    await waitFor(() => expect(reloadInventory).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('reinicia selección al cambiar de grupo, reabrir o cambiar de conteo', async () => {
    api.fetchStockCounts.mockResolvedValue([listed, { ...listed, id: 'count-2', subtitle: 'Otro control cerrado' }]);
    api.fetchStockCount.mockImplementation(async (_user, id: string) => ({ ...closed, id }));
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    const check = () => screen.getByRole('checkbox', { name: /iPhone 13 mini/ });
    await actor.click(check());
    await actor.click(screen.getByRole('button', { name: 'Faltan 1' }));
    expect(check()).toBeChecked();
    await actor.click(screen.getByRole('button', { name: 'Sobran 1' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByTestId('stock-adjust')).toBeDisabled();
    await actor.click(screen.getByRole('checkbox'));
    await actor.click(screen.getByRole('button', { name: 'Faltan 1' }));
    expect(check()).not.toBeChecked();
    await actor.click(check());
    await actor.click(screen.getByRole('button', { name: 'Volver' }));
    await actor.click(screen.getByRole('button', { name: /Cerrado hoy 11:05/ }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    await actor.click(check());
    await actor.click(screen.getByRole('button', { name: 'Volver' }));
    await actor.click(screen.getByRole('button', { name: /Otro control cerrado/ }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    expect(screen.getByTestId('stock-adjust')).toBeDisabled();
    expect(api.resolveStockCount).not.toHaveBeenCalled();
  });

  it('conserva confirmación y selección ante fallo y carga solo los sobrantes elegidos al reintentar', async () => {
    context.appSession = { membership: { role: 'MANAGER', sections: ['inventory'] } };
    api.fetchStockCounts.mockResolvedValue([listed]);
    api.resolveStockCount.mockRejectedValueOnce(new Error('No se pudo guardar el control (503)'));
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    await actor.click(await screen.findByRole('checkbox', { name: /iPhone 13 mini/ }));
    await actor.click(screen.getByRole('button', { name: 'Sobran 1' }));
    await actor.click(screen.getByRole('checkbox'));
    await actor.click(screen.getByTestId('stock-adjust'));
    const dialog = await screen.findByRole('dialog', { name: 'Cargar 1 equipo seleccionado' });
    expect(dialog).toHaveTextContent('pendientes de completar sus datos');
    expect(dialog).not.toHaveTextContent('Motivo de archivo');
    await actor.click(within(dialog).getByRole('button', { name: 'Cargar 1 equipo seleccionado' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('503');
    expect(reloadInventory).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { hidden: true })).toBeChecked();
    await actor.click(within(dialog).getByRole('button', { name: 'Cargar 1 equipo seleccionado' }));
    await waitFor(() => expect(api.resolveStockCount).toHaveBeenLastCalledWith(user, 'count-1', {
      mode: 'ADJUST', missingIds: [], surplusImeis: ['352098117747702'],
    }));
    await waitFor(() => expect(reloadInventory).toHaveBeenCalledTimes(1));
  });

  it.each(['STAFF', 'MANAGER'])('no ofrece selección ni resolución a %s sin permiso', async (role) => {
    context.appSession = { membership: { role, sections: role === 'STAFF' ? ['inventory'] : ['sales'] } };
    api.fetchStockCounts.mockResolvedValue([listed]);
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    await screen.findByText('Coinciden');
    for (const group of ['Faltan 1', 'Sobran 1', 'Figuran vendidos 1', 'Coinciden 1']) {
      await actor.click(screen.getByRole('button', { name: group }));
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('stock-adjust')).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument();
  });

  it.each(['ADJUSTED', 'RECORDED'] as const)('mantiene resultados %s en solo lectura', async (resolution) => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    api.fetchStockCount.mockResolvedValue({ ...closed, resolution });
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    await screen.findByText('Coinciden');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-adjust')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-record')).not.toBeInTheDocument();
  });

  it.each([
    { scanCount: 0, missing: closed.buckets.missing, title: 'Sin escaneos', copy: 'no confirman pérdidas' },
    { scanCount: 49, missing: closed.buckets.missing, title: 'Conteo con equipos sin escanear', copy: '1 equipo esperado no se escaneó' },
    { scanCount: 2, missing: [], title: 'Sin faltantes en la comparación', copy: 'Esto no confirma que se haya revisado todo el local' },
  ])('distingue cobertura $title sin reclasificar excluidos', async ({ scanCount, missing, title, copy }) => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    api.fetchStockCount.mockResolvedValue({ ...closed, scanCount, buckets: { ...closed.buckets, missing } });
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    const coverage = await screen.findByTestId('stock-coverage');
    expect(coverage).toHaveTextContent(title);
    expect(coverage).toHaveTextContent(copy);
    expect(screen.getByTestId('stock-excluded')).toHaveTextContent('3 equipos excluidos sin IMEI');
    expect(screen.getByTestId('stock-excluded')).toHaveTextContent('no se consideran faltantes');
    expect(screen.getByRole('button', { name: `Faltan ${missing.length}` })).toBeInTheDocument();
    expect(screen.getByTestId('stock-adjust')).toBeDisabled();
  });

  it('cierra un control sin escaneos sin preseleccionar', async () => {
    api.fetchCurrentStockCount.mockResolvedValue({ ...blind, mine: 0, total: 0, scans: [] });
    api.closeStockCount.mockResolvedValue({ ...closed, scanCount: 0 });
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: 'Cerrar control' }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    expect(screen.getByTestId('stock-adjust')).toBeDisabled();
    expect(screen.getByTestId('stock-coverage')).toHaveTextContent('Sin escaneos');
    expect(api.resolveStockCount).not.toHaveBeenCalled();
  });

  it('muestra un error de carga sin preparar ninguna acción', async () => {
    api.fetchStockCounts.mockResolvedValue([listed]);
    api.fetchStockCount.mockRejectedValue(new Error('No se pudo abrir el control (503)'));
    const actor = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    desk(<StockCountScreen onBack={vi.fn()} />);
    await actor.click(await screen.findByRole('button', { name: /Cerrado hoy 11:05/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('503');
    expect(screen.queryByTestId('stock-adjust')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
