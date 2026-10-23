import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupplierDetail as SupplierFile, SupplierListItem } from '../../services/suppliers-api';
import { DeskProvider } from '../ui';
import { SupplierDetail, SupplierForm } from './supplier';

const ctx = vi.hoisted(() => ({
  suppliers: [] as SupplierListItem[], saveSupplier: vi.fn(), archiveSupplier: vi.fn(), restoreSupplier: vi.fn(),
  user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER', sections: null as string[] | null } },
}));
const fetchSupplier = vi.hoisted(() => vi.fn());
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/suppliers-api', () => ({ fetchSupplier }));
vi.mock('../exchange', () => ({ useMoney: () => ({ show: (value: number) => `US$ ${value}` }) }));
const close = vi.fn();
const open = vi.fn();
const toast = vi.fn();
const supplier: SupplierFile = {
  id: 'supplier', name: 'Mayorista Centro', phone: '+54 261 555 0106', email: 'compras@mayoristacentro.example.com',
  notes: 'Retirar por sucursal.\nConsultar disponibilidad.', deletedAt: null, deviceCount: 2, problemCount: 1,
  purchases: [{
    id: 'purchase', purchasedAt: '2026-10-14', notes: 'Retiro acordado.', problemCount: 1,
    items: [{ id: 'device', model: 'iPhone 15 Pro', capacity: '256GB', imei: '356789104523871', status: 'EN_REVISION', cost: 900, currency: 'USD', problem: true, problemLabel: 'En revisión', createdAt: '2026-10-14T15:00:00Z' }],
  }, {
    id: 'sin-lote', purchasedAt: '', notes: 'Equipos con proveedor y sin compra agrupada.', problemCount: 0,
    items: [{ id: 'loose', model: 'iPhone 14', capacity: '128GB', imei: '', status: 'DISPONIBLE', cost: 700, currency: 'USD', problem: false, problemLabel: null, createdAt: '2026-10-13T15:00:00Z' }],
  }],
};
function mount(node: ReactNode) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false }}>{node}</DeskProvider></div>);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  ctx.suppliers = [supplier];
  ctx.appSession.membership = { role: 'OWNER', sections: null };
  fetchSupplier.mockResolvedValue(supplier);
  ctx.saveSupplier.mockResolvedValue(supplier);
  ctx.archiveSupplier.mockResolvedValue(undefined);
  ctx.restoreSupplier.mockResolvedValue(supplier);
});

describe('formulario de proveedor', () => {
  it('requires a name and saves only after validation, trimming the name', async () => {
    mount(<SupplierForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));
    expect(screen.getByText('Completá el nombre.')).toBeInTheDocument();
    expect(ctx.saveSupplier).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Nombre'), '  Nuevo mayorista  ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));
    await waitFor(() => expect(ctx.saveSupplier).toHaveBeenCalledWith({ name: 'Nuevo mayorista', phone: '', email: '', notes: '' }, undefined));
    expect(close).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith('Proveedor cargado');
  });
  it('prefills all edit fields and saves through the existing supplier id', async () => {
    mount(<SupplierForm id="supplier" />);
    expect(screen.getByLabelText('Nombre')).toHaveValue(supplier.name);
    expect(screen.getByLabelText('Teléfono')).toHaveValue(supplier.phone);
    expect(screen.getByLabelText('Email')).toHaveValue(supplier.email);
    expect(screen.getByLabelText('Notas')).toHaveValue(supplier.notes);
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Nueva nota' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.saveSupplier).toHaveBeenCalledWith({ name: supplier.name, phone: supplier.phone, email: supplier.email, notes: 'Nueva nota' }, 'supplier'));
  });
  it('keeps the draft on error and retries without closing as success', async () => {
    ctx.saveSupplier.mockRejectedValueOnce(new Error('No se guardó'));
    mount(<SupplierForm id="supplier" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nuevo@example.com' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó');
    expect(screen.getByLabelText('Email')).toHaveValue('nuevo@example.com');
    expect(close).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it('blocks editing, close, Escape and duplicate submits while saving', async () => {
    const pending = deferred<SupplierListItem>();
    ctx.saveSupplier.mockReturnValue(pending.promise);
    mount(<SupplierForm id="supplier" />);
    const form = screen.getByLabelText('Nombre').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(ctx.saveSupplier).toHaveBeenCalledOnce();
    for (const label of ['Nombre', 'Teléfono', 'Email', 'Notas']) expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(close).not.toHaveBeenCalled();
    await act(async () => pending.resolve(supplier));
    expect(close).toHaveBeenCalledOnce();
  });
  it('supports Enter to submit and Cancelar without a write', async () => {
    mount(<SupplierForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(close).toHaveBeenCalledOnce();
    expect(ctx.saveSupplier).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Mayorista nuevo{Enter}');
    await waitFor(() => expect(ctx.saveSupplier).toHaveBeenCalledOnce());
  });
});

describe('ficha de proveedor', () => {
  it('preserves full long contact values in titles when mobile text is truncated', async () => {
    const email = `${'compras'.repeat(24)}@mayoristacentro.example.com`;
    const phone = '+54 261 555 0106 / +54 261 555 0107 / +54 261 555 0108';
    fetchSupplier.mockResolvedValue({ ...supplier, email, phone });
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    for (const value of [email, phone]) {
      const contact = screen.getByText(value);
      expect(contact.tagName).toBe('DD');
      expect(contact).toHaveAttribute('title', value);
      expect(contact.closest('.supplier-contact')).not.toBeNull();
    }
  });
  it('uses a silent skeleton until the detail resolves', async () => {
    const pending = deferred<SupplierFile>();
    fetchSupplier.mockReturnValue(pending.promise);
    mount(<SupplierDetail id="supplier" />);
    expect(screen.getByTestId('supplier-loading')).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar equipo' })).not.toBeInTheDocument();
    await act(async () => pending.resolve(supplier));
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
  });
  it('shows a visible query error and retries', async () => {
    fetchSupplier.mockRejectedValueOnce(new Error('No se pudo cargar el detalle'));
    mount(<SupplierDetail id="supplier" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el detalle');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByTestId('supplier-detail')).toBeInTheDocument();
    expect(fetchSupplier).toHaveBeenCalledTimes(2);
  });
  it('groups purchases, preserves full IMEI and state, and opens the selected equipment', async () => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    const purchase = screen.getByRole('region', { name: 'Compra del 14/10/2026' });
    expect(within(purchase).getByText('356789104523871')).toBeInTheDocument();
    expect(within(purchase).getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText(supplier.email!)).toBeInTheDocument();
    expect(screen.getByTestId('supplier-problems')).toHaveTextContent('1 de 2 equipos están en revisión o en servicio.');
    expect(screen.getByRole('region', { name: 'Sin compra agrupada' })).toHaveTextContent('Sin IMEI');
    expect(screen.queryByText('Equipos con proveedor y sin compra agrupada.')).not.toBeInTheDocument();
    await userEvent.click(within(purchase).getByRole('button'));
    expect(open).toHaveBeenCalledWith({ type: 'eq', id: 'device' });
  });
  it('keeps the main action in the footer and secondary actions in a disclosure', async () => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.getByRole('button', { name: 'Registrar equipo' }).closest('.sheet-foot')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar equipo' }));
    expect(open).toHaveBeenCalledWith({ type: 'new-eq', supplierId: 'supplier' });
    const disclosure = screen.getByText('Más acciones').closest('details')!;
    expect(disclosure).not.toHaveAttribute('open');
    await userEvent.click(screen.getByText('Más acciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Subir stock' }));
    expect(open).toHaveBeenCalledWith({ type: 'import', kind: 'inv', supplierId: 'supplier', supplierName: supplier.name });
    expect(disclosure).not.toHaveAttribute('open');
    await userEvent.click(screen.getByText('Más acciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(open).toHaveBeenCalledWith({ type: 'edit-supplier', id: 'supplier' });
  });
  it('hides costs from staff without financial permission', async () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['inventory'] };
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.queryByText('US$ 900')).not.toBeInTheDocument();
    expect(screen.queryByText('US$ 700')).not.toBeInTheDocument();
    expect(screen.getByText('356789104523871')).toBeInTheDocument();
  });
  it('shows costs with permission and handles an empty supplier without placeholder contact', async () => {
    const view = mount(<SupplierDetail id="supplier" />);
    expect(await screen.findByText('US$ 900')).toBeInTheDocument();
    view.unmount();
    fetchSupplier.mockResolvedValue({ ...supplier, phone: null, email: null, notes: null, deviceCount: 0, problemCount: 0, purchases: [] });
    mount(<SupplierDetail id="empty" />);
    expect(await screen.findByText('Todavía no hay compras.')).toBeInTheDocument();
    expect(screen.queryByText('Teléfono')).not.toBeInTheDocument();
    expect(screen.queryByTestId('supplier-problems')).not.toBeInTheDocument();
  });
  it.each(['Cancelar', 'Cerrar', 'Escape', 'backdrop'])('replaces the detail with a single archive dialog and returns without refetch on %s', async (dismissal) => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByText('Más acciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    const confirmation = screen.getByRole('dialog', { name: 'Archivar proveedor' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByTestId('supplier-detail')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar equipo' })).not.toBeInTheDocument();
    expect(ctx.archiveSupplier).not.toHaveBeenCalled();
    if (dismissal === 'Escape') await userEvent.keyboard('{Escape}');
    else if (dismissal === 'backdrop') fireEvent.mouseDown(confirmation.parentElement!);
    else await userEvent.click(within(confirmation).getByRole('button', { name: dismissal }));
    expect(screen.queryByRole('dialog', { name: 'Archivar proveedor' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
    expect(screen.getByText(supplier.email!)).toBeInTheDocument();
    expect(screen.getByText('356789104523871')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-loading')).not.toBeInTheDocument();
    expect(fetchSupplier).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(ctx.archiveSupplier).not.toHaveBeenCalled();
  });
  it('confirms through the existing endpoint', async () => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByText('Más acciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Archivar proveedor' })).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(ctx.archiveSupplier).toHaveBeenCalledWith('supplier', ''));
    expect(close).toHaveBeenCalledOnce();
  });
  it('keeps the archive reason and error in the only dialog until a successful retry', async () => {
    ctx.archiveSupplier.mockRejectedValueOnce(new Error('No se pudo archivar'));
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByText('Más acciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicado' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Detalle' }), 'Registro repetido');
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo archivar');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByTestId('supplier-detail')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Detalle' })).toHaveValue('Registro repetido');
    expect(screen.getByRole('button', { name: 'Duplicado' })).toHaveAttribute('aria-pressed', 'true');
    expect(close).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(ctx.archiveSupplier).toHaveBeenNthCalledWith(2, 'supplier', 'Duplicado · Registro repetido');
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(toast).toHaveBeenCalledWith('Proveedor archivado');
  });
  it('offers only restoration for archived suppliers and keeps failures visible', async () => {
    fetchSupplier.mockResolvedValue({ ...supplier, deletedAt: '2026-10-22T15:00:00Z' });
    ctx.restoreSupplier.mockRejectedValueOnce(new Error('No se pudo restaurar'));
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.queryByText('Más acciones')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar equipo' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo restaurar');
    expect(close).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });
  it('ignores a stale response after the supplier changes', async () => {
    const pending = deferred<SupplierFile>();
    fetchSupplier.mockReturnValueOnce(pending.promise);
    const view = mount(<SupplierDetail id="supplier" />);
    view.rerender(<div className="desk-app"><DeskProvider value={{ tab: 'suppliers', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false }}><SupplierDetail id="other" /></DeskProvider></div>);
    await screen.findByTestId('supplier-detail');
    await act(async () => pending.resolve({ ...supplier, name: 'Respuesta vieja' }));
    expect(screen.queryByText('Respuesta vieja')).not.toBeInTheDocument();
  });
});

 it('renders no connection notice or replacement copy when the detail load fails offline', async () => {
  fetchSupplier.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  mount(<SupplierDetail id="supplier" />);
  await waitFor(() => expect(screen.queryByTestId('supplier-loading')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/No hay conexión|Sin conexión|No se pudo completar/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
});
