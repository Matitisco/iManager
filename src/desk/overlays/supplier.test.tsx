import { textContent } from '../../test/text-content';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupplierDetail as SupplierFile, SupplierListItem, SupplierPurchaseDetail } from '../../services/suppliers-api';
import { DeskProvider } from '../ui';
import { SupplierDetail, SupplierForm } from './supplier';
import { returnsView } from '../returns-navigation';

const ctx = vi.hoisted(() => ({
  inventory: [], sales: [], tradeIns: [], returns: [], reloadLedger: vi.fn(), reloadInventory: vi.fn(), addProduct: vi.fn(),
  suppliers: [] as SupplierListItem[], saveSupplier: vi.fn(), archiveSupplier: vi.fn(), restoreSupplier: vi.fn(),
  user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER', sections: null as string[] | null } },
}));
const layout = vi.hoisted(() => ({ phone: false }));
vi.mock('../section-notices', async original => ({ ...await original<typeof import('../section-notices')>(), usePhoneLayout: () => layout.phone }));
const { fetchSupplier, fetchSupplierPurchase } = vi.hoisted(() => ({ fetchSupplier: vi.fn(), fetchSupplierPurchase: vi.fn() }));
const { fetchHistory } = vi.hoisted(() => ({ fetchHistory: vi.fn() }));
vi.mock('../../services/history-api', () => ({ fetchHistory }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/suppliers-api', () => ({ fetchSupplier, fetchSupplierPurchase }));
vi.mock('../exchange', () => ({ useMoney: () => ({ active: 'USD', show: (value: number) => `US$ ${value}`, inputValue: (value: number) => String(value) }) }));
const close = vi.fn();
const open = vi.fn();
const toast = vi.fn();
const supplier: SupplierFile = {
  id: 'supplier', name: 'Mayorista Centro', phone: '+54 261 555 0106', email: 'compras@mayoristacentro.example.com',
  notes: 'Retirar por sucursal.\nConsultar disponibilidad.', deletedAt: null, deviceCount: 2, problemCount: 1,
  stockCount: 1, claimedDeviceCount: 1, costTotals: [{ currency: 'USD', totalCost: 1600 }],
  purchases: [{
    id: 'purchase', name: null, purchasedAt: '2026-10-14', notes: 'Retiro acordado.', devices: 2, problemCount: 1, claimCount: 1,
    totalCost: 1600, currency: 'USD',
  }],
};
const purchaseFile: SupplierPurchaseDetail = {
  ...supplier.purchases[0], summary: { devices: 2, problems: 1 },
  items: [
    { id: 'device', model: 'iPhone 15 Pro', capacity: '256GB', imei: '356789104523871', status: 'EN_REVISION', cost: 900, currency: 'USD', problem: true, problemLabel: 'En revisión', createdAt: '2026-10-14T15:00:00Z' },
    { id: 'loose', model: 'iPhone 14', capacity: '128GB', imei: '', status: 'DISPONIBLE', cost: 700, currency: 'USD', problem: false, problemLabel: null, createdAt: '2026-10-13T15:00:00Z' },
  ],
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
  history.replaceState(null, '', '#/finanzas/proveedores');
  layout.phone = false;
  ctx.suppliers = [supplier];
  ctx.appSession.membership = { role: 'OWNER', sections: null };
  fetchSupplier.mockResolvedValue(supplier);
  fetchSupplierPurchase.mockResolvedValue(purchaseFile);
  fetchHistory.mockResolvedValue({ events: [], nextCursor: null });
  ctx.reloadLedger.mockResolvedValue(undefined);
  ctx.addProduct.mockResolvedValue({ id: 'new' });
  ctx.saveSupplier.mockResolvedValue(supplier);
  ctx.archiveSupplier.mockResolvedValue(undefined);
  ctx.restoreSupplier.mockResolvedValue(supplier);
});

it('links the supplier problem notice to its selected patterns and closes the file', async () => {
  mount(<SupplierDetail id="supplier" />);
  await userEvent.click(await screen.findByRole('button', { name: `Ver fallas de ${supplier.name}` }));
  expect(close).toHaveBeenCalledOnce();
  expect(returnsView(window.location.hash)).toEqual({ patterns: true, groupBy: 'supplier', group: 'supplier' });
});

it('keeps the problem notice informational when returns access is missing', async () => {
  ctx.appSession.membership = { role: 'STAFF', sections: ['inventory'] };
  mount(<SupplierDetail id="supplier" />);
  await screen.findByTestId('supplier-detail');
  expect(screen.getByTestId('supplier-problems').tagName).toBe('SPAN');
  expect(screen.queryByRole('button', { name: /Ver fallas/ })).not.toBeInTheDocument();
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
  it('shows investment first with history, stock and the actual last purchase date', async () => {
    fetchSupplier.mockResolvedValue({ ...supplier, lastPurchasedAt: '2026-10-14' });
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.getByText('En stock').nextElementSibling).toHaveTextContent('1 de 2 equipos');
    expect(screen.getByText('Con problemas').nextElementSibling).toHaveTextContent('1 de 2 equipos');
    expect(screen.getByRole('button', { name: 'Historial' }).closest('.tracking-summary')).not.toBeNull();
    expect(screen.getByText('Total invertido').nextElementSibling).toHaveTextContent('US$ 1600');
    expect(screen.getByRole('dialog').querySelector('.sheet-h .sub')).toHaveTextContent('Última compra · 14/10/2026');
    expect(fetchHistory).not.toHaveBeenCalled();
  });
  it('opens paginated supplier history only from its icon and returns to the same file', async () => {
    const event = { id: 'event', action: 'supplier.created', title: 'Proveedor creado', actorName: 'Ana', createdAt: '2026-10-14T15:00:00Z', changes: [], detail: 'Se registró Mayorista Centro.', reason: null };
    fetchHistory.mockResolvedValueOnce({ events: [event], nextCursor: 'next' }).mockResolvedValueOnce({ events: [{ ...event, id: 'second', detail: 'Se actualizó el teléfono.' }], nextCursor: null });
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.queryByText(event.detail)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    const history = screen.getByRole('dialog', { name: 'Historial' });
    expect(await within(history).findByText(event.detail)).toBeInTheDocument();
    expect(within(history).getByText('Se actualizó el teléfono.')).toBeInTheDocument();
    expect(fetchHistory).toHaveBeenLastCalledWith(ctx.user, { entityType: 'supplier', entityId: 'supplier', limit: 50, cursor: 'next' });
    expect(history.parentElement).toHaveClass('subov');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Historial' })).not.toBeInTheDocument();
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
    expect(fetchSupplier).toHaveBeenCalledOnce();
  });
  it('preserves full long contact values and their titles', async () => {
    const email = `${'compras'.repeat(24)}@mayoristacentro.example.com`;
    const phone = '+54 261 555 0106 / +54 261 555 0107 / +54 261 555 0108';
    fetchSupplier.mockResolvedValue({ ...supplier, email, phone });
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    for (const value of [email, phone]) {
      const contact = screen.getByText(value);
      expect(contact.tagName).toBe('B');
      expect(contact).toHaveAttribute('title', value);
      expect(contact.closest('.kv')).not.toBeNull();
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
  it('shows a neutral query error without a retry action', async () => {
    fetchSupplier.mockRejectedValueOnce(new Error('No se pudo cargar el detalle'));
    mount(<SupplierDetail id="supplier" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el detalle');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });
  it('opens a purchase over the file with full IMEI and problem states', async () => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.getByTestId('supplier-problems')).toHaveTextContent('1 de 2 equipos');
    expect(screen.queryByText(/Sin IMEI|Sin compra/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /14\/10\/2026/ }));
    const purchase = await screen.findByTestId('supplier-purchase-detail');
    expect(within(purchase).getByText(textContent('IMEI 356789104523871'))).toBeInTheDocument();
    expect(within(purchase).getByText('En revisión')).toBeInTheDocument();
    expect(fetchSupplierPurchase).toHaveBeenCalledWith(ctx.user, 'supplier', 'purchase');
    expect(purchase.closest('.ov')).toHaveClass('center', 'subov');
    await userEvent.click(within(purchase).getByRole('button', { name: /iPhone 15 Pro/ }));
    expect(open).toHaveBeenCalledWith({ type: 'eq', id: 'device' });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('supplier-purchase-detail')).not.toBeInTheDocument();
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
  it.each([0, 3, 5])('shows Ver todas only above three purchases (%s)', async count => {
    fetchSupplier.mockResolvedValue({ ...supplier, purchases: Array.from({ length: count }, (_, i) => ({ ...supplier.purchases[0], id: `p${i}`, name: `Lote ${i}` })) });
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    const all = screen.queryByRole('button', { name: `Ver todas (${count})` });
    expect(!!all).toBe(count > 3);
    expect(screen.getByTestId('supplier-detail').querySelectorAll('.sup-buy')).toHaveLength(Math.min(count, 3));
    if (all) {
      await userEvent.click(all);
      const history = screen.getByRole('dialog', { name: 'Compras' });
      expect(within(history).getAllByRole('button', { name: /Lote/ })).toHaveLength(count);
      expect(history.parentElement).toHaveClass('subov');
      await userEvent.click(within(history).getByRole('button', { name: /Lote 4/ }));
      expect(await screen.findByRole('dialog', { name: 'Lote 4' })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByRole('dialog', { name: 'Compras' })).toBeInTheDocument();
      expect(close).not.toHaveBeenCalled();
    }
  });
  it('keeps Cargar stock in the footer and offers the two inventory flows', async () => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.getByRole('button', { name: 'Cargar stock' }).closest('.sheet-foot')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cargar stock' }));
    const chooser = screen.getByRole('dialog', { name: 'Cargar stock' });
    expect(within(chooser).getByRole('button', { name: /Registrar equipo/ })).toBeInTheDocument();
    expect(within(chooser).getByRole('button', { name: /Subir listado/ })).toBeInTheDocument();
    expect(screen.queryByText('Carga en serie')).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByText('Más acciones'));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(open).toHaveBeenCalledWith({ type: 'edit-supplier', id: 'supplier' });
  });
  it.each([true, false])('gates purchase totals and item costs with financial access (%s)', async allowed => {
    if (!allowed) ctx.appSession.membership = { role: 'STAFF', sections: ['inventory'] };
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.queryAllByText('US$ 1600').length > 0).toBe(allowed);
    await userEvent.click(screen.getByRole('button', { name: /14\/10\/2026/ }));
    await screen.findByTestId('supplier-purchase-detail');
    expect(!!screen.queryByText('US$ 900')).toBe(allowed);
    expect(screen.getByText(textContent('IMEI 356789104523871'))).toBeInTheDocument();
    expect(screen.queryByText('Sin IMEI')).not.toBeInTheDocument();
  });
  it('shows missing contact and a single empty purchase row without zero investment', async () => {
    fetchSupplier.mockResolvedValue({ ...supplier, phone: null, email: null, notes: null, deviceCount: 0, problemCount: 0, purchases: [] });
    mount(<SupplierDetail id="empty" />);
    await screen.findByTestId('supplier-detail');
    expect(screen.queryByRole('region', { name: 'Compras' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Sin cargar')).toHaveLength(2);
    expect(screen.getByTestId('supplier-empty')).toHaveTextContent('Sin compras registradas');
    expect(screen.queryByText('Total invertido')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Historial' }).closest('.sheet-h')).not.toBeNull();
    expect(screen.queryByTestId('supplier-problems')).not.toBeInTheDocument();
  });
  it('uses full screen mobile purchase layers with a back arrow and returns to the file', async () => {
    layout.phone = true;
    fetchSupplierPurchase.mockResolvedValue({ ...purchaseFile, items: [
      { ...purchaseFile.items[0], problemLabel: 'En RMA' },
      { ...purchaseFile.items[1], problemLabel: 'Reclamo' },
    ] });
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByRole('button', { name: /14\/10\/2026/ }));
    const purchase = await screen.findByTestId('supplier-purchase-detail');
    const dialog = purchase.closest('[role="dialog"]')! as HTMLElement;
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toHaveClass('wback');
    expect(within(dialog).queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    expect(within(purchase).getByText('En RMA')).toBeInTheDocument();
    expect(within(purchase).getByText('Reclamo')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Volver' }));
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
  it('shows a failed purchase request without discarding the supplier file', async () => {
    fetchSupplierPurchase.mockRejectedValueOnce(new Error('Unavailable'));
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByRole('button', { name: /14\/10\/2026/ }));
    await waitFor(() => expect(fetchSupplierPurchase).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('supplier-purchase-detail')).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir la compra.');
    expect(screen.queryByText(/Reintentar|No hay conexión/)).not.toBeInTheDocument();
  });
  it('reuses EquipmentForm with a locked supplier, keeps failures open and refreshes after saving', async () => {
    ctx.addProduct.mockRejectedValueOnce(new Error('No se pudo guardar el equipo'));
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar stock' }));
    await userEvent.click(screen.getByRole('button', { name: /Registrar equipo/ }));
    const form = screen.getByRole('dialog', { name: 'Registrar equipo' });
    expect(within(form).getByRole('combobox', { name: 'Proveedor' })).toBeDisabled();
    expect(within(form).getByRole('combobox', { name: 'Proveedor' })).toHaveTextContent(supplier.name);
    fireEvent.change(within(form).getByLabelText('Modelo'), { target: { value: 'iPhone 13' } });
    fireEvent.change(within(form).getByLabelText('Precio de venta'), { target: { value: '500' } });
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar equipo' }));
    expect(await screen.findByText('No se pudo guardar el equipo')).toBeInTheDocument();
    expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'supplier', model: 'iPhone 13' }));
    expect(form).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    fetchSupplier.mockResolvedValue({ ...supplier, deviceCount: 3, stockCount: 2 });
    await userEvent.click(within(form).getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar equipo' })).not.toBeInTheDocument());
    expect(ctx.reloadLedger).toHaveBeenCalledOnce();
    expect(fetchSupplier).toHaveBeenCalledTimes(2);
    expect(screen.getByText('En stock').nextElementSibling).toHaveTextContent('2');
    expect(close).not.toHaveBeenCalled();
  });
  it('returns to the loaded file without refetch when registration is cancelled', async () => {
    mount(<SupplierDetail id="supplier" />);
    await screen.findByTestId('supplier-detail');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar stock' }));
    await userEvent.click(screen.getByRole('button', { name: /Registrar equipo/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Registrar equipo' })).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('supplier-detail')).toBeInTheDocument();
    expect(fetchSupplier).toHaveBeenCalledOnce();
    expect(ctx.addProduct).not.toHaveBeenCalled();
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
    expect(screen.getByText('Retiro acordado.', { exact: false })).toBeInTheDocument();
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
