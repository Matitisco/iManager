import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { ExpensesScreen } from './ExpensesScreen';
import { SuppliersScreen } from './SuppliersScreen';

const context = vi.hoisted(() => ({
  user: { uid: 'user-1' },
  suppliers: null as Array<{ id: string; name: string; phone: null; email: null; notes: null; deviceCount: number; problemCount: number; lastPurchasedAt?: string | null; deletedAt: null }> | null,
  supplierError: '',
  expenses: null as Array<{ id: string; date: string; category: string; amount: number; currency: 'ARS'; exchangeRate: null; notes: null; deletedAt: null }> | null,
  expensesLoaded: false,
  expenseError: '',
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function desk(child: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      {child}
    </DeskProvider>,
  );
}

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

  it('shows problem pills only for positive counts, and omits missing purchase dates', () => {
    context.suppliers = [
      { id: 'a', name: 'Andes', phone: null, email: null, notes: null, deviceCount: 18, problemCount: 5, lastPurchasedAt: '2026-10-02', deletedAt: null },
      { id: 'b', name: 'Cuyo', phone: null, email: null, notes: null, deviceCount: 7, problemCount: 0, lastPurchasedAt: null, deletedAt: null },
    ];
    desk(<SuppliersScreen />);
    expect(screen.getByText('18 equipos · última compra 02/10')).toBeInTheDocument();
    const pill = screen.getByLabelText('5 con problemas');
    expect(pill.querySelector('[data-icon="en-revision"]')).not.toBeNull();
    expect(pill.querySelector('.sup-pill-t')).toHaveTextContent('con problemas');
    expect(screen.queryByLabelText('0 con problemas')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cuyo/ })).toHaveTextContent('7 equipos');
    expect(screen.getByRole('button', { name: /Cuyo/ })).not.toHaveTextContent(/última compra|Sin proveedor|—/);
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
});
