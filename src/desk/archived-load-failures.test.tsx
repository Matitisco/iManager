import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryScreen } from './screens/InventoryScreen';
import { SalesScreen } from './screens/SalesScreen';
import { TradeInsScreen } from './screens/TradeInsScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { ServiceScreen } from './screens/ServiceScreen';
import { ExpensesScreen } from './screens/ExpensesScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { ReturnsScreen } from './screens/ReturnsScreen';
import { useArchivedRows } from './use-archived-rows';
import { DeskProvider } from './ui';

const context = vi.hoisted(() => ({
  user: { uid: 'u', getIdToken: async () => 'test' }, backendStatus: 'ready',
  appSession: { store: { id: 'store' }, membership: { role: 'OWNER', sections: null }, onboardingRequired: false },
  inventory: [], sales: [], tradeIns: [], clients: [], repairOrders: [], expenses: [], expensesLoaded: true,
  suppliers: [], returns: [], commissionSellers: [], loadCommissionSellers: vi.fn(),
}));
const archive = vi.hoisted(() => vi.fn());
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../services/inventory-api', () => ({ fetchArchivedInventory: archive }));
vi.mock('../services/sales-api', () => ({ fetchVoidedSales: archive }));
vi.mock('../services/trade-ins-api', () => ({ fetchVoidedTradeIns: archive }));
vi.mock('../services/clients-api', () => ({ fetchArchivedClients: archive }));
vi.mock('../services/repairs-api', () => ({ fetchArchivedRepairs: archive }));
vi.mock('../services/expenses-api', () => ({ fetchExpenses: archive }));
vi.mock('../services/suppliers-api', () => ({ fetchSuppliers: archive }));
vi.mock('../services/returns-api', () => ({ fetchReturns: archive }));

beforeEach(() => {
  archive.mockReset(); context.appSession.store.id = 'store';
  context.loadCommissionSellers.mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe.each([
  { name: 'equipos', Component: InventoryScreen, filter: 'Archivados', empty: 'Todavía no cargaste equipos' },
  { name: 'clientes', Component: ClientsScreen, filter: 'Archivados', empty: 'No encontré clientes.' },
  { name: 'servicio', Component: ServiceScreen, filter: 'Archivados', empty: 'No encontré órdenes.' },
  { name: 'gastos', Component: ExpensesScreen, filter: 'Archivados', empty: 'No hay gastos archivados.' },
  { name: 'proveedores', Component: SuppliersScreen, filter: 'Archivados', empty: 'No hay proveedores archivados.' },
  { name: 'reclamos', Component: ReturnsScreen, filter: 'Archivados', empty: 'No hay reclamos archivados.' },
  { name: 'ventas', Component: SalesScreen, filter: null, empty: 'No encontré ventas.' },
  { name: 'canjes', Component: TradeInsScreen, filter: null, empty: 'No encontré canjes.' },
])('$name', ({ Component, filter, name, empty }) => {
  it('logs failed archive loads and keeps a neutral empty list without alerts', async () => {
    const cause = new Error('No se pudieron cargar los registros archivados o anulados.');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    archive.mockRejectedValue(cause);
    render(<DeskProvider value={{ tab: 'dashboard', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><Component /></DeskProvider>);
    await waitFor(() => expect(warn).toHaveBeenCalledWith(cause.message, cause));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    if (filter) fireEvent.click(screen.getByRole('button', { name: filter }));
    if (name === 'servicio') fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(await screen.findByText(empty)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
  });
});

it('ignores late archive failures from a previous tenant', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let reject!: (cause: Error) => void;
  const load = vi.fn().mockReturnValueOnce(new Promise((_, fail) => { reject = fail; })).mockResolvedValueOnce([{ id: 'current' }]);
  const remember = vi.fn();
  const activeRows: { id: string }[] = [];
  const { result, rerender } = renderHook(() => useArchivedRows(activeRows, load, remember));
  expect(result.current.loading).toBe(true);
  context.appSession.store.id = 'other'; rerender();
  await waitFor(() => expect(result.current.rows).toEqual([{ id: 'current' }]));
  reject(new Error('Obsolete request'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(warn).not.toHaveBeenCalled();
  expect(remember).toHaveBeenCalledExactlyOnceWith([{ id: 'current' }]);
  expect(result.current.rows).toEqual([{ id: 'current' }]);
});
