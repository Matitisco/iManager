import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, Sale, TradeIn } from '../../types';
import { ExchangeProvider } from '../exchange';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';
import { ClientsScreen } from './ClientsScreen';
import { SalesScreen } from './SalesScreen';
import { TradeInsScreen } from './TradeInsScreen';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[], clients: [] as Client[], sales: [] as Sale[], tradeIns: [] as TradeIn[],
  appSession: { store: { id: 's', name: 'Tienda' }, user: { id: 'u' }, membership: { role: 'OWNER' } },
  backendStatus: 'ready', operationNotifications: [], operationDrafts: [],
  deleteProduct: vi.fn(), deleteClient: vi.fn(), updateSale: vi.fn(), cancelTradeOperation: vi.fn(),
}));
const csv = vi.hoisted(() => vi.fn());
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../csv', () => ({ downloadCsv: csv }));
const open = vi.fn();
function mount(Component: React.ComponentType) {
  return render(<DeskProvider value={{ tab: 'inventory', isStaff: false, canManageSensitive: true, open, openRecord: vi.fn(), close: vi.fn(), go: vi.fn(), toast: vi.fn() }}><Component /></DeskProvider>);
}
const product = (id: string): Product => ({ id, imei: id, model: `Equipo ${id}`, capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 500, price: 900, currency: 'USD', status: 'DISPONIBLE' });
function confirm(action: string) {
  fireEvent.click(screen.getByRole('button', { name: action }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: action }));
}
beforeEach(() => {
  open.mockClear();
  ctx.inventory = [product('1'), product('2')];
  ctx.clients = [{ id: 'c', name: 'Ana', dni: '123', email: '', phone: '', lastPurchaseDate: '', totalSpent: 0, pendingBalance: 0 }];
  ctx.sales = [{ id: 's1', saleNumber: 1, date: new Date().toISOString(), clientId: 'c', productId: '1', amount: 900, amountCurrency: 'USD', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', integratedOperation: true }];
  ctx.tradeIns = [{ id: 't1', tradeNumber: 1, date: new Date().toISOString(), clientId: 'c', deviceReceived: 'iPhone 11', deviceReceivedImei: '', deviceGiven: 'Equipo 1', takeValue: 100, differencePaid: 800, status: 'PENDIENTE', confirmationStatus: 'CONFIRMED' }];
  for (const fn of [ctx.deleteProduct, ctx.deleteClient, ctx.updateSale, ctx.cancelTradeOperation]) fn.mockReset().mockResolvedValue(undefined);
});

describe('bulk table wiring', () => {
  it.each([
    { table: 'inventory', Component: InventoryScreen, name: 'Equipo 1', overlay: { type: 'eq', id: '1' } },
    { table: 'clients', Component: ClientsScreen, name: 'Ana', overlay: { type: 'cl', id: 'c' } },
    { table: 'sales', Component: SalesScreen, name: 'V-0001', overlay: { type: 'sale', id: 's1' } },
    { table: 'trades', Component: TradeInsScreen, name: 'C-0001', overlay: { type: 'cj', id: 't1' } },
  ] as const)('keeps cell names and row activation independent of selection in $table', ({ Component, name, overlay }) => {
    mount(Component);
    const cell = screen.getByRole('cell', { name: new RegExp(name) });
    const row = cell.closest('tr')!;
    const checkbox = within(row).getByRole('checkbox', { name: new RegExp(`Seleccionar ${name}`) });
    fireEvent.click(cell);
    expect(open).toHaveBeenLastCalledWith(overlay);
    expect(checkbox).not.toBeChecked();

    open.mockClear();
    fireEvent.click(checkbox.closest('label')!);
    expect(checkbox).toBeChecked();
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('cell', { name: new RegExp(name) })).toBe(cell);

    fireEvent.click(row);
    expect(open).toHaveBeenLastCalledWith(overlay);
    expect(checkbox).toBeChecked();
    fireEvent.click(within(row).getAllByRole('cell')[0]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(checkbox).toBeChecked();
  });

  it('selects inventory across pages, prunes filters, exports without cost, and reuses deletion', async () => {
    ctx.inventory = Array.from({ length: 10 }, (_, index) => product(String(index)));
    mount(InventoryScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los filtrados (10)' }));
    expect(screen.getByText('10 seleccionados')).toBeInTheDocument(); expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByRole('checkbox', { name: /Seleccionar Equipo 9/ })).toBeChecked();
    fireEvent.change(screen.getByPlaceholderText('Buscar modelo o color'), { target: { value: 'Equipo 1' } });
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar selección' }));
    expect(csv).toHaveBeenCalledWith(expect.arrayContaining([expect.arrayContaining(['US$ 900', 'USD'])]), 'inventario-seleccion.csv');
    expect(csv.mock.calls[0][0][0]).not.toContain('Costo');
    confirm('Eliminar selección'); await waitFor(() => expect(ctx.deleteProduct).toHaveBeenCalledWith('1'));
    expect(ctx.deleteProduct).toHaveBeenCalledTimes(1);
  });
  it('deletes clients through the existing method', async () => {
    mount(ClientsScreen); fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Ana' }));
    confirm('Eliminar selección'); await waitFor(() => expect(ctx.deleteClient).toHaveBeenCalledWith('c'));
  });
  it('cancels integrated sales and refuses already cancelled/historical sales', async () => {
    const { unmount } = mount(SalesScreen); fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar V-/ }));
    confirm('Cancelar ventas'); await waitFor(() => expect(ctx.updateSale).toHaveBeenCalledWith(expect.objectContaining({ id: 's1', status: 'CANCELADA' })));
    unmount(); ctx.sales[0].integratedOperation = false; mount(SalesScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar V-/ }));
    expect(screen.getByRole('button', { name: 'Cancelar ventas' })).toBeDisabled();
    expect(screen.getByText(/Las ventas históricas/)).toBeInTheDocument();
  });
  it('exports each row in the currency and amount the table shows', () => {
    const settings = { currency: 'USD' as const, exchangeMode: 'manual' as const, exchangeSource: 'blue' as const, manualBuy: 1500, manualSell: 1540 };
    ctx.sales = [
      { id: 's189', saleNumber: 189, date: new Date().toISOString(), clientId: 'c', productId: '1', amount: 1_145_000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', integratedOperation: true },
      { id: 's188', saleNumber: 188, date: new Date().toISOString(), clientId: 'c', productId: '1', amount: 350, amountCurrency: null, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', integratedOperation: true },
    ];
    ctx.clients = [{ id: 'c', name: 'Ana Larga', dni: '30111222', email: 'ana.larga@ejemplo.com', phone: '2614000000', lastPurchaseDate: '', totalSpent: 350, pendingBalance: 0, balanceCurrency: null }];
    ctx.tradeIns = [{ id: 't1', tradeNumber: 1, date: new Date().toISOString(), clientId: 'c', deviceReceived: 'iPhone 11', deviceReceivedImei: '', deviceGiven: 'Equipo 1', takeValue: 350, differencePaid: 744, currency: null, status: 'PENDIENTE', confirmationStatus: 'CONFIRMED' }];
    const desk = (tab: 'sales' | 'clients' | 'tradeins', node: React.ReactNode) => render(
      <ExchangeProvider settings={settings}>
        <DeskProvider value={{ tab, isStaff: false, canManageSensitive: true, open, openRecord: vi.fn(), close: vi.fn(), go: vi.fn(), toast: vi.fn() }}>{node}</DeskProvider>
      </ExchangeProvider>,
    );
    const salesView = desk('sales', <SalesScreen />);
    expect(screen.getByText('US$ 744')).toBeInTheDocument();
    expect(screen.getByText('US$ 350')).toBeInTheDocument();
    expect(screen.getByText('#V-0189')).toHaveClass('keep');
    expect(screen.getByText('US$ 744').closest('b')).toHaveClass('keep');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los filtrados (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar selección' }));
    const saleRows = csv.mock.calls.at(-1)?.[0] as string[][];
    expect(saleRows[0]).toContain('Moneda');
    const sale189 = saleRows.find((row) => row[0] === 'V-0189');
    const sale188 = saleRows.find((row) => row[0] === 'V-0188');
    expect(sale189).toEqual(expect.arrayContaining(['US$ 744', 'USD']));
    expect(sale188).toEqual(expect.arrayContaining(['US$ 350', 'USD']));
    expect(sale189?.join(',')).not.toContain('1145000');
    expect(sale188).not.toContain('ARS');
    salesView.unmount();

    csv.mockClear();
    const clientsView = desk('clients', <ClientsScreen />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Ana Larga' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar selección' }));
    const clientRow = (csv.mock.calls.at(-1)?.[0] as string[][]).find((row) => row[0] === 'Ana Larga');
    expect(clientRow).toEqual(expect.arrayContaining(['US$ 350', 'USD']));
    expect(clientRow).not.toContain('ARS');
    clientsView.unmount();

    csv.mockClear();
    desk('tradeins', <TradeInsScreen />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar C-/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar selección' }));
    const tradeRow = (csv.mock.calls.at(-1)?.[0] as string[][]).find((row) => row.includes('USD'));
    expect(tradeRow).toEqual(expect.arrayContaining(['US$ 350', 'US$ 744', 'USD']));
    expect(tradeRow).not.toContain('ARS');
  });

  it('cancels trade operations through their source and keeps historical trades exportable', async () => {
    const { unmount } = mount(TradeInsScreen); fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar C-/ }));
    confirm('Cancelar canjes'); await waitFor(() => expect(ctx.cancelTradeOperation).toHaveBeenCalledWith('tradeins', 't1'));
    unmount(); ctx.tradeIns[0].confirmationStatus = null; mount(TradeInsScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar C-/ }));
    expect(screen.getByRole('button', { name: 'Cancelar canjes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exportar selección' })).toBeEnabled();
  });
});
