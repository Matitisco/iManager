import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradeIn } from '../../types';
import type { CatalogOption } from '../../services/catalogs-api';
import { DeskProvider } from '../ui';
import { TradeInsScreen } from './TradeInsScreen';

const state = vi.hoisted(() => ({
  tradeIns: [] as TradeIn[],
  clients: [{ id: 'client', name: 'Ana Pérez' }],
  catalog: { ready: true, options: [] as CatalogOption[] },
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => state }));
vi.mock('../catalog', () => ({ useCatalogs: () => state.catalog }));
const open = vi.fn();

function trade(number: number, overrides: Partial<TradeIn> = {}): TradeIn {
  return { id: String(number), tradeNumber: number, date: `2026-10-${String(number).padStart(2, '0')}`, clientId: 'client',
    deviceReceived: `Recibido ${number}`, deviceReceivedImei: String(number).padStart(15, '0'),
    deviceGiven: `Entregado ${number}`, takeValue: number * 1000, differencePaid: number * 100, status: 'PENDIENTE', ...overrides };
}
function renderScreen() {
  return render(<DeskProvider value={{ tab: 'tradeins', go: vi.fn(), open, close: vi.fn(), toast: vi.fn(), isStaff: false }}><TradeInsScreen /></DeskProvider>);
}
const rows = () => within(screen.getByRole('table', { name: 'Canjes' })).getAllByRole('row').slice(1);

describe('Trade-ins table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.tradeIns = Array.from({ length: 12 }, (_, i) => trade(i + 1));
    state.catalog = { ready: true, options: [
      { id: 'pending', kind: 'TRADE_IN_STATUS', value: 'PENDIENTE', label: 'Pendiente', color: '#E8A33D', isSystem: true, sortOrder: 0, count: 12 },
    ] };
  });

  it('paginates twelve records, resets after search/filter/sort and clamps after removals', async () => {
    const user = userEvent.setup();
    state.tradeIns[0].status = 'DIAGNOSTICO';
    const view = renderScreen();
    expect(rows()).toHaveLength(8);
    expect(within(rows()[0]).getByText('#C-0012')).toBeInTheDocument();
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(rows()).toHaveLength(4);
    expect(screen.getByText('9–12 de 12')).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Buscar cliente, equipo, IMEI o número');
    await user.type(search, 'C-0002');
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('Recibido 2')).toBeInTheDocument();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    await user.click(screen.getByRole('button', { name: 'DIAGNOSTICO' }));
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('#C-0001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    await user.click(screen.getByRole('button', { name: 'Recientes' }));
    await user.click(screen.getByRole('button', { name: 'Antiguos' }));
    expect(within(rows()[0]).getByText('#C-0001')).toBeInTheDocument();
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    state.tradeIns = state.tradeIns.slice(0, 4);
    view.rerender(<DeskProvider value={{ tab: 'tradeins', go: vi.fn(), open, close: vi.fn(), toast: vi.fn(), isStaff: false }}><TradeInsScreen /></DeskProvider>);
    expect(rows()).toHaveLength(4);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });

  it('retains historical and blank imported records without restoring absent default states', async () => {
    const user = userEvent.setup();
    state.tradeIns = [trade(1, { status: 'HISTORICO', differencePaid: -500 }), trade(2, {
      date: '', clientId: '', deviceReceived: '', deviceReceivedImei: '', deviceGiven: '', status: '', takeValue: 0, differencePaid: 0,
    })];
    renderScreen();
    expect(rows()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Rechazado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Peritaje téc.' })).not.toBeInTheDocument();
    expect(screen.getByText('Entregado 1')).toBeInTheDocument();
    expect(screen.getByText('Dif. $ -500')).toBeInTheDocument();
    expect(screen.getByText('Consumidor final')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sin estado' }));
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getAllByText('—')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'HISTORICO' }));
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('Recibido 1')).toBeInTheDocument();
  });

  it('opens details and the existing context menu from rows and keeps create/import actions', async () => {
    const user = userEvent.setup();
    state.tradeIns = [trade(1)];
    renderScreen();
    await user.click(rows()[0]);
    expect(open).toHaveBeenLastCalledWith({ type: 'cj', id: '1' });
    fireEvent.contextMenu(rows()[0], { clientX: 80, clientY: 100 });
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ctx', kind: 'cj', id: '1', label: 'C-0001 · Ana Pérez' }));
    const calls = open.mock.calls.length;
    fireEvent.click(rows()[0]);
    expect(open).toHaveBeenCalledTimes(calls);
    await user.click(screen.getByRole('button', { name: 'Nuevo canje' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'new-cj' });
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'import', kind: 'cj' });
  });

  it('searches client, equipment and IMEI and shows an explicit empty result', async () => {
    const user = userEvent.setup();
    state.tradeIns = [trade(1), trade(2)];
    renderScreen();
    const search = screen.getByPlaceholderText('Buscar cliente, equipo, IMEI o número');
    for (const query of ['Ana Pérez', 'Entregado 2', '000000000000001']) {
      await user.clear(search); await user.type(search, query);
      expect(rows()).toHaveLength(query === 'Ana Pérez' ? 2 : 1);
    }
    await user.clear(search); await user.type(search, 'No existe');
    expect(screen.getByText('No encontré canjes.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
