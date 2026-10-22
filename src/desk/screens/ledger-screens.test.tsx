import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpenseView } from '../../services/expenses-api';
import type { SupplierListItem } from '../../services/suppliers-api';
import { DeskProvider } from '../ui';
import { ExpensesScreen } from './ExpensesScreen';
import { SuppliersScreen } from './SuppliersScreen';

const context = vi.hoisted(() => ({
  user: { uid: 'user-1' },
  suppliers: null as SupplierListItem[] | null,
  supplierError: '',
  expenses: null as ExpenseView[] | null,
  appSession: { store: { id: 'store', timezone: 'America/Argentina/Buenos_Aires' }, membership: { role: 'OWNER' } },
  expensesLoaded: false,
  expenseError: '',
}));

const reportApi = vi.hoisted(() => ({ fetch: vi.fn() }));
const go = vi.fn();
vi.mock('../../services/net-profit-api', () => ({ fetchNetProfit: reportApi.fetch }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function desk(child: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'suppliers', go, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      {child}
    </DeskProvider>,
  );
}

beforeEach(() => {
  context.expenseError = ''; context.supplierError = '';
  reportApi.fetch.mockResolvedValue({ currency: 'ARS', blocked: false, expenses: 1200, grossProfit: 10000, netProfit: 8800 });
});

describe('proveedores y gastos', () => {
  it('muestra el esqueleto y no el vacío mientras cargan', () => {
    context.suppliers = null;
    context.expenses = null;
    context.expensesLoaded = false;
    desk(<SuppliersScreen />);
    expect(screen.getByTestId('suppliers-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('suppliers-empty')).not.toBeInTheDocument();
    desk(<ExpensesScreen />);
    expect(screen.getByTestId('expenses-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('expenses-empty')).not.toBeInTheDocument();
  });

  it('muestra el vacío recién cuando la lista llegó vacía', () => {
    context.suppliers = [];
    context.expenses = [];
    context.expensesLoaded = true;
    desk(<SuppliersScreen />);
    expect(screen.getByText('Todavía no cargaste proveedores.')).toBeInTheDocument();
    desk(<ExpensesScreen />);
    expect(screen.getByText('Todavía no cargaste gastos.')).toBeInTheDocument();
  });
  it('filtra por mes y categoría sin modificar el resumen mensual ni afirmar un pago', async () => {
    context.expensesLoaded = true;
    context.expenses = [
      { id: 'one', date: '2026-10-12', category: 'Servicios', notes: 'Internet del local', amount: 100.25, currency: 'USD', exchangeRate: 1555, deletedAt: null },
      { id: 'two', date: '2026-10-14', category: 'Alquiler', notes: null, amount: 1200, currency: 'ARS', exchangeRate: null, deletedAt: null },
      { id: 'old', date: '2026-09-10', category: 'Otros', notes: 'Septiembre', amount: 50, currency: 'ARS', exchangeRate: null, deletedAt: null },
    ];
    desk(<ExpensesScreen />);
    fireEvent.change(screen.getByLabelText('Período mensual'), { target: { value: '2026-10' } });
    expect(await screen.findByText('$ 8.800')).toBeVisible();
    expect(screen.getByText('US$ 100,25')).toBeVisible();
    expect(screen.queryByText('Septiembre')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Categorías de gastos' })).getByRole('button', { name: 'Servicios' }));
    expect(screen.getByTestId('expense-one')).toBeVisible();
    expect(screen.queryByTestId('expense-two')).not.toBeInTheDocument();
    expect(screen.getByText('$ 8.800')).toBeVisible();
    expect(screen.queryByText(/Egreso registrado|Pagado desde caja|Pagado fuera/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Cajas' }));
    expect(go).toHaveBeenCalledWith('cash');
  });

  it('mantiene importes desconocidos como guiones y muestra fallo o cotización faltante', async () => {
    context.expenses = []; context.expensesLoaded = true;
    reportApi.fetch.mockResolvedValue({ currency: 'ARS', blocked: true, expenses: null, grossProfit: null, netProfit: null });
    const view = desk(<ExpensesScreen />);
    expect(await screen.findByText(/falta una cotización válida/)).toBeVisible();
    expect(screen.getAllByText('—')).toHaveLength(3);
    view.unmount();
    reportApi.fetch.mockRejectedValue(new Error('Resumen no disponible'));
    context.expenseError = 'Lista no disponible';
    desk(<ExpensesScreen />);
    expect(await screen.findByText('Resumen no disponible')).toBeVisible();
    expect(screen.getByText('Lista no disponible')).toBeVisible();
    expect(screen.queryByTestId('expenses-empty')).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('presenta contacto, equipos y última compra reales sin agregar canjes como proveedor', () => {
    context.suppliers = [{ id: 'sup', name: 'Mayorista Centro', phone: '1144445555', email: 'ventas@example.test', notes: null, deviceCount: 2, problemCount: 1, deletedAt: null, lastPurchaseAt: '2026-10-15' },
      { id: 'old', name: 'Contrato anterior', phone: null, email: null, notes: null, deviceCount: 1, problemCount: 0, deletedAt: null },
      { id: 'empty', name: 'Sin contacto', phone: null, email: null, notes: null, deviceCount: 0, problemCount: 0, deletedAt: null, lastPurchaseAt: null }];
    desk(<SuppliersScreen />);
    expect(screen.getByText('1144445555')).toBeVisible();
    expect(screen.getByText('ventas@example.test')).toBeVisible();
    expect(screen.getByText('Última compra 15/10/2026')).toBeVisible();
    expect(screen.getAllByText('Sin contacto registrado')).toHaveLength(2);
    expect(screen.getByTestId('supplier-old')).toHaveTextContent('—');
    expect(screen.getByText('Sin compras registradas')).toBeVisible();
    expect(screen.queryByText('Particulares (canjes)')).not.toBeInTheDocument();
  });

});
