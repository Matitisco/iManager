import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SupplierListItem } from '../../services/suppliers-api';
import { DeskProvider } from '../ui';
import { SuppliersScreen } from './SuppliersScreen';

const ctx = vi.hoisted(() => ({
  suppliers: [] as SupplierListItem[], supplierError: '',
  user: { uid: 'qa-finanzas' }, backendStatus: 'ready',
  appSession: { store: { id: 'qa-finanzas-store' }, membership: { role: 'OWNER' } },
}));
const { fetchSuppliers } = vi.hoisted(() => ({ fetchSuppliers: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/suppliers-api', () => ({ fetchSuppliers }));
const open = vi.fn();
const supplier: SupplierListItem = {
  id: 'qa-finanzas-supplier', name: 'QA finanzas proveedor', phone: null, email: null,
  notes: null, deviceCount: 1, problemCount: 0, deletedAt: null,
};

function mount() {
  return render(<div className="desk-app"><DeskProvider value={{
    tab: 'suppliers', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false,
  }}><SuppliersScreen /></DeskProvider></div>);
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.suppliers = [];
  fetchSuppliers.mockResolvedValue([]);
});

it('communicates archived status in both list filters and preserves access to restoration', async () => {
  fetchSuppliers.mockResolvedValue([{ ...supplier, deletedAt: '2026-10-24T18:00:00Z' }]);
  mount();
  const row = await screen.findByRole('button', { name: /QA finanzas proveedor.*Archivado/ });
  expect(within(row).getByText('Archivado')).toBeVisible();
  expect(row).toHaveClass('is-void');
  await userEvent.click(screen.getByRole('button', { name: 'Archivados' }));
  await userEvent.click(screen.getByRole('button', { name: /QA finanzas proveedor.*Archivado/ }));
  expect(open).toHaveBeenCalledWith({ type: 'supplier', id: supplier.id });
});

it('does not call active suppliers archived', async () => {
  ctx.suppliers = [supplier];
  mount();
  const row = screen.getByRole('button', { name: /QA finanzas proveedor/ });
  expect(within(row).queryByText('Archivado')).not.toBeInTheDocument();
  expect(row).not.toHaveClass('is-void');
  await userEvent.click(screen.getByRole('button', { name: 'Activos' }));
  expect(screen.getByRole('button', { name: /QA finanzas proveedor/ })).toBeVisible();
});

it('reports no active suppliers when existing suppliers are archived', async () => {
  fetchSuppliers.mockResolvedValue([{ ...supplier, deletedAt: '2026-10-24T18:00:00Z' }]);
  mount();
  await screen.findByRole('button', { name: /QA finanzas proveedor/ });
  await userEvent.click(screen.getByRole('button', { name: 'Activos' }));
  expect(screen.getByRole('heading', { name: 'No hay proveedores activos.' })).toBeVisible();
  expect(screen.queryByText('Todavía no cargaste proveedores.')).not.toBeInTheDocument();
});

it('preserves the first-use and archived empty states', async () => {
  mount();
  expect(screen.getByRole('heading', { name: 'Todavía no cargaste proveedores.' })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Archivados' }));
  expect(await screen.findByRole('heading', { name: 'No hay proveedores archivados.' })).toBeVisible();
});
