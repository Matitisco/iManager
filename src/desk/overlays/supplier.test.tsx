import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SupplierDetail as SupplierFile } from '../../services/suppliers-api';
import { DeskProvider } from '../ui';
import { SupplierDetail } from './supplier';

const api = vi.hoisted(() => ({ fetch: vi.fn(), archive: vi.fn(), restore: vi.fn(), open: vi.fn(), close: vi.fn() }));
const user = { uid: 'owner' };
let role: 'OWNER' | 'STAFF' = 'OWNER';
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ user, appSession: { membership: { role, sections: ['inventory'] } }, archiveSupplier: api.archive, restoreSupplier: api.restore }) }));
vi.mock('../../services/suppliers-api', () => ({ fetchSupplier: api.fetch }));
vi.mock('../exchange', () => ({ useMoney: () => ({ show: (amount: number) => `USD ${amount}` }) }));
let detail: SupplierFile;
beforeEach(() => {
  role = 'OWNER';
  detail = { id: 'sup', name: 'Mayorista Centro', phone: '1144445555', email: null, notes: 'Entrega por la mañana', deviceCount: 2, problemCount: 1, deletedAt: null, lastPurchaseAt: '2026-10-15', purchases: [
    { id: 'purchase', purchasedAt: '2026-10-15', notes: null, problemCount: 0, items: [{ id: 'eq1', model: 'iPhone 14', capacity: '128 GB', imei: '', status: 'DISPONIBLE', cost: 500, currency: 'USD', problem: false, problemLabel: null, createdAt: '2026-10-15T12:00:00Z' }] },
    { id: 'sin-lote', purchasedAt: '', notes: null, problemCount: 1, items: [{ id: 'eq2', model: 'iPhone 12', capacity: '64 GB', imei: '', status: 'EN_REVISION', cost: 300, currency: 'USD', problem: true, problemLabel: 'En revisión', createdAt: '2026-10-10T12:00:00Z' }] },
  ] };
  api.fetch.mockImplementation(async () => detail);
  api.archive.mockResolvedValue(undefined); api.restore.mockResolvedValue(undefined);
});
function setup() {
  render(<DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open: api.open, openRecord: vi.fn(), close: api.close, toast: vi.fn(), isStaff: role === 'STAFF' }}><SupplierDetail id="sup" /></DeskProvider>);
}

it('prioriza contacto y equipos, conserva compras agrupadas y precarga el proveedor', async () => {
  setup();
  expect(await screen.findByTestId('supplier-detail')).toHaveTextContent('1144445555');
  expect(screen.getByText('15/10/2026')).toBeVisible();
  expect(screen.getByText('Sin compra agrupada')).toBeVisible();
  expect(screen.getByText('USD 500')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Registrar equipo' })).toHaveClass('p');
  expect(document.querySelector('.sheet-action-menu')).not.toHaveAttribute('open');
  await userEvent.click(screen.getByRole('button', { name: 'Registrar equipo' }));
  expect(api.open).toHaveBeenCalledWith({ type: 'new-eq', supplierId: 'sup' });
  await userEvent.click(screen.getByRole('button', { name: 'Subir stock' }));
  expect(api.open).toHaveBeenCalledWith({ type: 'import', kind: 'inv', supplierId: 'sup', supplierName: 'Mayorista Centro' });
  expect(api.archive).not.toHaveBeenCalled();
});

it('no expone costos al empleado y comunica contacto faltante', async () => {
  role = 'STAFF'; detail.phone = null;
  setup();
  expect(await screen.findByText('Sin contacto registrado.')).toBeVisible();
  expect(screen.queryByText('USD 500')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /iPhone 12/ }));
  expect(api.open).toHaveBeenCalledWith({ type: 'eq', id: 'eq2' });
});

it('archivar exige confirmación y conserva el detalle cuando falla', async () => {
  api.archive.mockRejectedValue(new Error('No se pudo archivar'));
  setup(); await screen.findByTestId('supplier-detail');
  fireEvent.click(screen.getByText('Más acciones'));
  await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Archivar proveedor' })).getByRole('button', { name: 'Archivar' }));
  expect(api.archive).toHaveBeenCalledWith('sup');
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo archivar');
  expect(api.close).not.toHaveBeenCalled();
});

it('restaura archivados y presenta errores de carga sin acciones de escritura', async () => {
  detail.deletedAt = '2026-10-20T12:00:00Z';
  const view = render(<DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open: api.open, openRecord: vi.fn(), close: api.close, toast: vi.fn(), isStaff: false }}><SupplierDetail id="sup" /></DeskProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));
  expect(api.restore).toHaveBeenCalledWith('sup');
  view.unmount();
  api.fetch.mockRejectedValue(new Error('No se pudo cargar proveedor'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar proveedor');
  expect(screen.queryByRole('button', { name: 'Registrar equipo' })).not.toBeInTheDocument();
});
