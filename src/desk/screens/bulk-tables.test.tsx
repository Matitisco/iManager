import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  deleteProduct: vi.fn(), deleteClient: vi.fn(), deleteSale: vi.fn(), updateSale: vi.fn(), cancelTradeOperation: vi.fn(), deleteTradeIn: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
const open = vi.fn();
let restoreMedia: (() => void) | undefined;
afterEach(() => { restoreMedia?.(); restoreMedia = undefined; vi.useRealTimers(); });
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
  for (const fn of [ctx.deleteProduct, ctx.deleteClient, ctx.deleteSale, ctx.updateSale, ctx.cancelTradeOperation, ctx.deleteTradeIn]) fn.mockReset().mockResolvedValue(undefined);
});

describe('bulk table wiring', () => {
  it.each([
    { table: 'inventory', Component: InventoryScreen, execute: ctx.deleteProduct, action: 'Archivar selección', result: '1 archivado · 1 no se pudo archivar' },
    { table: 'clients', Component: ClientsScreen, execute: ctx.deleteClient, action: 'Archivar selección', result: '1 archivado · 1 no se pudo archivar' },
    { table: 'sales', Component: SalesScreen, execute: ctx.deleteSale, action: 'Anular', result: '1 anulado · 1 no se pudo anular' },
    { table: 'trades', Component: TradeInsScreen, execute: ctx.deleteTradeIn, action: 'Anular', result: '1 anulado · 1 no se pudo anular' },
  ])('continues and uses the action participle in $table', async ({ Component, execute, action, result }) => {
    ctx.clients.push({ ...ctx.clients[0], id: 'c2', name: 'Beatriz' });
    ctx.sales.push({ ...ctx.sales[0], id: 's2', saleNumber: 2 });
    ctx.tradeIns.push({ ...ctx.tradeIns[0], id: 't2', tradeNumber: 2 });
    execute.mockRejectedValueOnce(new Error('Operación activa'));
    mount(Component);
    fireEvent.click(screen.getByRole('checkbox', { name: /^Seleccionar todos/ }));
    confirm(action);
    await screen.findByText(result);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Listo' }));
    expect(screen.getByRole('button', { name: action })).toBeEnabled();
  });

  it.each([
    { table: 'inventory', Component: InventoryScreen, name: 'Equipo 1', overlay: { type: 'eq', id: '1' } },
    { table: 'clients', Component: ClientsScreen, name: 'Ana', overlay: { type: 'cl', id: 'c' } },
    { table: 'sales', Component: SalesScreen, name: 'V-0001', overlay: { type: 'sale', id: 's1' } },
    { table: 'trades', Component: TradeInsScreen, name: 'C-0001', overlay: { type: 'cj', id: 't1' } },
  ] as const)('keeps cell names and row activation independent of selection in $table', ({ Component, name, overlay }) => {
    mount(Component);
    const headers = screen.getAllByRole('columnheader');
    expect(within(headers[0]).getByRole('checkbox', { name: /^Seleccionar todos/ })).toBeInTheDocument();
    for (const dataRow of screen.getAllByRole('row').slice(1)) {
      expect(within(within(dataRow).getAllByRole('cell')[0]).getByRole('checkbox', { name: /^Seleccionar / })).toBeInTheDocument();
    }
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

  it('keeps entry date as the second stock header and cell, after selection', () => {
    ctx.inventory[0].entryDate = '2026-10-27';
    mount(InventoryScreen);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveClass('bulk-cell');
    expect(within(headers[0]).getByRole('checkbox', { name: /^Seleccionar todos/ })).toBeInTheDocument();
    expect(headers[1]).toHaveTextContent('Ingreso');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[0]).toHaveClass('bulk-cell');
      expect(within(cells[0]).getByRole('checkbox', { name: /^Seleccionar Equipo/ })).toBeInTheDocument();
      expect(cells[1]).toHaveClass('inv-entry-col');
      expect(cells[1]).toHaveTextContent(row.textContent?.includes('Equipo 1') ? '27/10/2026' : '—');
      expect(cells[2]).toHaveTextContent(/Equipo [12]/);
    }
  });

  it.each([
    { Component: InventoryScreen, name: 'Equipo 1', id: '1' },
    { Component: ClientsScreen, name: 'Ana', id: 'c' },
    { Component: SalesScreen, name: 'V-0001', id: 's1' },
    { Component: TradeInsScreen, name: 'C-0001', id: 't1' },
  ])('uses explicit mobile selection and the row sheet callback for $name', ({ Component, name, id }) => {
    vi.useFakeTimers();
    const previousMedia = window.matchMedia;
    restoreMedia = () => { window.matchMedia = previousMedia; };
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('760'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    mount(Component);
    expect(screen.queryByRole('checkbox', { name: /^Seleccionar/ })).not.toBeInTheDocument();
    const card = screen.getByRole('button', { name: new RegExp(name) });
    fireEvent.pointerDown(card, { pointerType: 'touch', clientX: 50, clientY: 50 });
    act(() => vi.advanceTimersByTime(480));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', id, onSelect: expect.any(Function) }));
    expect(screen.queryByRole('checkbox', { name: /^Seleccionar/ })).not.toBeInTheDocument();
    const onSelect = open.mock.calls.at(-1)![0].onSelect as () => void;
    act(() => onSelect());
    expect(screen.getByRole('checkbox', { name: new RegExp(`Seleccionar ${name}`) })).toBeChecked();
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(701)); fireEvent.click(card);
    expect(screen.getByText('0 seleccionados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('checkbox', { name: /^Seleccionar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
    expect(screen.getByText('0 seleccionados')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Seleccionar todos/ })).toBeVisible();
  });

  it('selects inventory across pages, prunes filters and reuses deletion', async () => {
    ctx.inventory = Array.from({ length: 10 }, (_, index) => product(String(index)));
    mount(InventoryScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los filtrados (10)' }));
    expect(screen.getByText('10 seleccionados')).toBeInTheDocument(); expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByRole('checkbox', { name: /Seleccionar Equipo 9/ })).toBeChecked();
    fireEvent.change(screen.getByPlaceholderText('Buscar modelo o color'), { target: { value: 'Equipo 1' } });
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    confirm('Archivar selección'); await waitFor(() => expect(ctx.deleteProduct).toHaveBeenCalledWith('1', ''));
    expect(ctx.deleteProduct).toHaveBeenCalledTimes(1);
  });
  it('deletes clients through the existing method', async () => {
    mount(ClientsScreen); fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Ana' }));
    confirm('Archivar selección'); await waitFor(() => expect(ctx.deleteClient).toHaveBeenCalledWith('c', ''));
  });
  it('voids integrated and historical sales with the same action', async () => {
    const { unmount } = mount(SalesScreen); fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar V-/ }));
    confirm('Anular'); await waitFor(() => expect(ctx.deleteSale).toHaveBeenCalledWith('s1', ''));
    unmount(); ctx.sales[0].integratedOperation = false; mount(SalesScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar V-/ }));
    confirm('Anular'); await waitFor(() => expect(ctx.deleteSale).toHaveBeenCalledTimes(2));
  });
  it('deletes cancelled integrated, linked and historical sales through the existing method', async () => {
    ctx.sales = [
      { ...ctx.sales[0], status: 'CANCELADA' },
      { ...ctx.sales[0], id: 's2', saleNumber: 2, status: 'CANCELADA', integratedOperation: false, tradeInId: 't1' },
      { ...ctx.sales[0], id: 's3', saleNumber: 3, status: 'CANCELADA', integratedOperation: false },
    ];
    mount(SalesScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar todos/ }));
    confirm('Anular');
    await waitFor(() => expect(ctx.deleteSale).toHaveBeenCalledTimes(3));
    expect(ctx.deleteSale.mock.calls).toEqual([['s1', ''], ['s2', ''], ['s3', '']]);
    expect(ctx.updateSale).not.toHaveBeenCalled();
  });
  it('handles active and historically cancelled records in one selection', () => {
    ctx.sales.push({ ...ctx.sales[0], id: 's2', saleNumber: 2, status: 'CANCELADA' });
    mount(SalesScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar todos/ }));
    expect(screen.getByRole('button', { name: 'Anular' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Cancelar/ })).not.toBeInTheDocument();
  });
  it('keeps sales amounts and codes on one line in the displayed currency', () => {
    const settings = { currency: 'USD' as const, exchangeMode: 'manual' as const, exchangeSource: 'blue' as const, manualBuy: 1500, manualSell: 1540 };
    ctx.sales = [
      { id: 's189', saleNumber: 189, date: new Date().toISOString(), clientId: 'c', productId: '1', amount: 1_145_000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA', integratedOperation: true },
      { id: 's188', saleNumber: 188, date: new Date().toISOString(), clientId: 'c', productId: '1', amount: 350, amountCurrency: null, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', integratedOperation: true },
    ];
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
    salesView.unmount();
  });

  it('voids integrated and historical trades with the same action', async () => {
    const { unmount } = mount(TradeInsScreen); fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar C-/ }));
    confirm('Anular'); await waitFor(() => expect(ctx.deleteTradeIn).toHaveBeenCalledWith('t1', ''));
    unmount(); ctx.tradeIns[0].confirmationStatus = null; mount(TradeInsScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar C-/ }));
    confirm('Anular'); await waitFor(() => expect(ctx.deleteTradeIn).toHaveBeenCalledTimes(2));
  });
  it('deletes cancelled trades through the existing method', async () => {
    ctx.tradeIns = [
      { ...ctx.tradeIns[0], status: 'CANCELADO', confirmationStatus: 'CANCELLED' },
      { ...ctx.tradeIns[0], id: 't2', tradeNumber: 2, status: 'CANCELADO', confirmationStatus: 'CANCELLED' },
    ];
    mount(TradeInsScreen);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar todos/ }));
    confirm('Anular');
    await waitFor(() => expect(ctx.deleteTradeIn).toHaveBeenCalledTimes(2));
    expect(ctx.deleteTradeIn.mock.calls.map((call) => call[0]).sort()).toEqual(['t1', 't2']);
    expect(ctx.cancelTradeOperation).not.toHaveBeenCalled();
  });
});
