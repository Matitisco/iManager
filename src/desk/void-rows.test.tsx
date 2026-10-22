import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, TradeIn, RepairOrder } from '../types';
import type { ExpenseView } from '../services/expenses-api';
import type { SupplierListItem } from '../services/suppliers-api';
import type { ReturnCaseView } from '../services/returns-api';
import { DeskProvider } from './ui';
import { isVoidRow, mergeRecordRows } from './format';
import { ServiceScreen } from './screens/ServiceScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { TradeInsScreen } from './screens/TradeInsScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { ReturnsScreen } from './screens/ReturnsScreen';
import { ExpenseForm } from './overlays/expense';

const state = vi.hoisted(() => ({
  user: { uid: 'owner', getIdToken: vi.fn() },
  appSession: { store: { id: 'store', name: 'Centro' }, membership: { role: 'OWNER' } },
  repairOrders: [] as RepairOrder[],
  inventory: [] as Product[], clients: [] as Client[], tradeIns: [] as TradeIn[],
  expenses: [] as ExpenseView[], suppliers: [] as SupplierListItem[], returns: [] as ReturnCaseView[],
  operationNotifications: [], operationDrafts: [], archiveExpense: vi.fn(),
}));
const api = vi.hoisted(() => ({ repairs: vi.fn(), inventory: vi.fn(), clients: vi.fn(), trades: vi.fn(), expenses: vi.fn(), suppliers: vi.fn(), returns: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => state }));
vi.mock('../services/repairs-api', () => ({ fetchArchivedRepairs: api.repairs }));
vi.mock('../services/inventory-api', () => ({ fetchArchivedInventory: api.inventory }));
vi.mock('../services/clients-api', () => ({ fetchArchivedClients: api.clients }));
vi.mock('../services/trade-ins-api', () => ({ fetchVoidedTradeIns: api.trades }));
vi.mock('../services/expenses-api', () => ({ fetchExpenses: api.expenses }));
vi.mock('../services/suppliers-api', () => ({ fetchSuppliers: api.suppliers }));
vi.mock('../services/returns-api', () => ({ fetchReturns: api.returns }));

const product: Product = { id: 'active', model: 'Equipo activo', capacity: '128 GB', color: 'Negro', condition: 'NUEVO', grade: '', batteryHealth: '100', cost: 10, price: 20, status: 'DISPONIBLE', imei: '' };
const client: Client = { id: 'active', name: 'Cliente activo', dni: '', email: '', phone: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0 };
const trade: TradeIn = { id: 'active', date: '2026-10-22', tradeNumber: 1, clientId: '', deviceReceived: 'Canje activo', deviceReceivedImei: '', deviceGiven: '', takeValue: 10, differencePaid: 0, status: 'PENDIENTE' };
const expense: ExpenseView = { id: 'active', date: '2026-10-22', category: 'Alquiler', amount: 10, currency: 'ARS', exchangeRate: null, notes: null, deletedAt: null };
const supplier: SupplierListItem = { id: 'active', name: 'Proveedor activo', phone: null, email: null, notes: null, deletedAt: null, deviceCount: 0, problemCount: 0 };
const claim = { id: 'active', code: 'R-0001', caseNumber: 1, clientName: 'Cliente', deviceLabel: 'Equipo', imei: '', openedOn: '2026-10-22', moneyAmount: 0, status: 'ABIERTO', rmaStatus: null, deletedAt: null } as ReturnCaseView;
function show(children: React.ReactNode, close = vi.fn()) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>{children}</DeskProvider></div>);
}
const originalMedia = window.matchMedia;
afterEach(() => { cleanup(); window.matchMedia = originalMedia; });
beforeEach(() => {
  window.matchMedia = vi.fn(query => ({ media: query, matches: false, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
  vi.clearAllMocks();
  Object.values(api).forEach(load => load.mockResolvedValue([]));
  state.appSession.store.id = 'store';
  state.repairOrders = [];
  state.inventory = [product]; state.clients = [client]; state.tradeIns = [trade];
  state.expenses = [expense]; state.suppliers = [supplier]; state.returns = [claim];
});

describe('logical deletion helper', () => {
  it.each([{ voidedAt: 'today' }, { archivedAt: 'today' }, { deletedAt: 'today' }, { status: 'CANCELADA' }, { status: 'CANCELLED' }, { status: 'ANULADA' }, { status: 'CANCELADO' }, { confirmationStatus: 'CANCELLED' }])('detects %j', row => expect(isVoidRow(row)).toBe(true));
  it.each([{}, { status: 'DISPONIBLE' }, { status: 'CERRADO' }, { status: 'RECHAZADO' }, { voidedAt: null, archivedAt: null, deletedAt: null }])('keeps active or completed %j', row => expect(isVoidRow(row)).toBe(false));
  it('prefers the refreshed active version after restoration without duplicate IDs', () => {
    expect(mergeRecordRows([{ id: 'same', archivedAt: null }], [{ id: 'same', archivedAt: 'old' }, { id: 'archived', archivedAt: 'old' }])).toEqual([{ id: 'same', archivedAt: null }, { id: 'archived', archivedAt: 'old' }]);
  });
});

describe.each([390, 1440])('archived list rows at %ipx', width => {
  beforeEach(() => {
    window.matchMedia = vi.fn(query => ({ media: query, matches: query.includes('max-width') && width === 390, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
  });
  it('fetches archived inventory in Todos, hides it in Disponible and retains Archivados', async () => {
    api.inventory.mockResolvedValue([{ ...product, id: 'archived', model: 'Equipo archivado', archivedAt: '2026-10-21' }]);
    show(<InventoryScreen />);
    const label = await screen.findByText('Equipo archivado · 128 GB');
    expect(label.closest(width === 390 ? '.phone-row' : 'tr')).toHaveClass('is-void');
    expect(api.inventory).toHaveBeenCalledWith(state.user);
    if (width === 390) {
      fireEvent.click(screen.getByRole('button', { name: 'Estado' }));
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Disponible' }));
    } else fireEvent.click(screen.getByRole('button', { name: 'Disponible' }));
    expect(screen.queryByText('Equipo archivado · 128 GB')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole(width === 390 ? 'menuitemcheckbox' : 'button', { name: 'Todos' }));
    if (width === 390) {
      fireEvent.click(screen.getByRole('button', { name: 'Estado' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(screen.queryByText('Equipo activo · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByText('Equipo archivado · 128 GB')).toBeInTheDocument();
  });
  it('keeps an archived client visible in red and isolates Archivados', async () => {
    api.clients.mockResolvedValue([{ ...client, id: 'archived', name: 'Cliente archivado', archivedAt: '2026-10-21' }]);
    show(<ClientsScreen />);
    expect((await screen.findByText('Cliente archivado')).closest(width === 390 ? '.phone-row' : 'tr')).toHaveClass('is-void');
    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(screen.queryByText('Cliente activo')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente archivado')).toBeInTheDocument();
  });
  it('shows cancelled and voided trades in red while excluding them from an active state', async () => {
    state.tradeIns = [trade, { ...trade, id: 'cancelled', deviceReceived: 'Canje cancelado', confirmationStatus: 'CANCELLED' }];
    api.trades.mockResolvedValue([{ ...trade, id: 'voided', deviceReceived: 'Canje anulado', voidedAt: '2026-10-21' }]);
    show(<TradeInsScreen />);
    expect((await screen.findByText(width === 390 ? 'Recibido: Canje anulado' : 'Canje anulado')).closest(width === 390 ? '.phone-row' : 'tr')).toHaveClass('is-void');
    expect(screen.getByText(width === 390 ? 'Recibido: Canje cancelado' : 'Canje cancelado').closest(width === 390 ? '.phone-row' : 'tr')).toHaveClass('is-void');
    expect(screen.queryByRole('button', { name: 'Cancelada' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelado' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anulada' }));
    expect(screen.getByText(width === 390 ? 'Recibido: Canje anulado' : 'Canje anulado')).toBeInTheDocument();
    expect(screen.getByText(width === 390 ? 'Recibido: Canje cancelado' : 'Canje cancelado')).toBeInTheDocument();
    expect(screen.queryByText(width === 390 ? 'Recibido: Canje activo' : 'Canje activo')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pendiente' }));
    expect(screen.queryByText(width === 390 ? 'Recibido: Canje anulado' : 'Canje anulado')).not.toBeInTheDocument();
    expect(screen.queryByText(width === 390 ? 'Recibido: Canje cancelado' : 'Canje cancelado')).not.toBeInTheDocument();
  });
  it.each([
    { Component: ExpensesScreen, load: api.expenses, row: { ...expense, id: 'archived', category: 'Gasto archivado', deletedAt: '2026-10-21' }, testId: 'expense-archived' },
    { Component: SuppliersScreen, load: api.suppliers, row: { ...supplier, id: 'archived', name: 'Proveedor archivado', deletedAt: '2026-10-21' }, testId: 'supplier-archived' },
    { Component: ReturnsScreen, load: api.returns, row: { ...claim, id: 'archived', code: 'R-0002', deletedAt: '2026-10-21' }, testId: 'return-archived' },
  ])('includes $testId only in Todos and Archivados', async ({ Component, load, row, testId }) => {
    load.mockResolvedValue([row]); show(<Component />);
    expect(await screen.findByTestId(testId)).toHaveClass('is-void');
    fireEvent.click(screen.getByRole('button', { name: 'Activos' }));
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(screen.getByTestId(testId)).toHaveClass('is-void');
  });
  it('keeps archived orders with a custom cancellation status visible in Todos', async () => {
    const repair: RepairOrder = { id: 'archived', orderNumber: 373, code: 'OT-0373', clientId: null, clientName: 'Cliente', clientPhone: '', device: 'Equipo cancelado', imei: '', fault: 'Pantalla', faultTags: [], estimate: 100, deposit: 0, technician: '', status: 'CANCELADA', estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '2026-10-22', whatsappUrl: null, events: [], archivedAt: '2026-10-22' };
    api.repairs.mockResolvedValue([repair]);
    show(<ServiceScreen />);
    if (width === 390) fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(await screen.findByTestId('repair-card-archived')).toHaveClass('is-void');
    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(screen.getByTestId('repair-card-archived')).toHaveClass('is-void');
  });
  it('keeps the reason and modal open after an archive failure', async () => {
    state.archiveExpense.mockRejectedValue(new Error('No se pudo archivar'));
    const close = vi.fn(); show(<ExpenseForm id="active" />, close);
    fireEvent.click(screen.getByText('Más acciones', { exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Archivar gasto' }));
    const modal = screen.getByRole('dialog', { name: 'Archivar gasto' });
    fireEvent.click(within(modal).getByRole('button', { name: 'Duplicado' }));
    fireEvent.change(within(modal).getByLabelText('Detalle'), { target: { value: 'Carga repetida' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(state.archiveExpense).toHaveBeenCalledWith('active', 'Duplicado · Carga repetida'));
    expect(await within(modal).findByRole('alert')).toHaveTextContent('No se pudo archivar');
    expect(within(modal).getByLabelText('Detalle')).toHaveValue('Carga repetida');
    expect(close).not.toHaveBeenCalled();
  });
});

it('keeps active rows visible and logs archive load failures without an alert', async () => {
  const cause = new Error('No se pudieron cargar archivados');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  api.inventory.mockRejectedValue(cause);
  show(<InventoryScreen />);
  await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar los registros archivados o anulados.', cause));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
  expect(document.querySelector('.ferr')).not.toBeInTheDocument();
  expect(screen.getByText('Equipo activo · 128 GB')).toBeInTheDocument();
  warn.mockRestore();
});

it('refetches archive records when an active row is archived', async () => {
  const view = show(<InventoryScreen />);
  await waitFor(() => expect(api.inventory).toHaveBeenCalledTimes(1));
  api.inventory.mockResolvedValue([{ ...product, id: 'active', archivedAt: '2026-10-22' }]);
  state.inventory = [];
  view.rerender(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><InventoryScreen /></DeskProvider></div>);
  await waitFor(() => expect(screen.getByText('Equipo activo · 128 GB').closest('tr')).toHaveClass('is-void'));
});
