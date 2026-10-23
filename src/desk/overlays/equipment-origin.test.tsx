import type { ReactNode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { fetchBackendInventoryItem, type InventoryItemDetail } from '../../services/inventory-api';
import { fetchSupplierPurchase } from '../../services/suppliers-api';
import { DeskProvider } from '../ui';
import { EquipmentDetail } from './equipment';

const ctx = vi.hoisted(() => ({
  user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER' } },
  inventory: [] as Product[], sales: [], repairOrders: [], updateProduct: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/inventory-api', () => ({ fetchBackendInventoryItem: vi.fn() }));
vi.mock('../../services/suppliers-api', () => ({ fetchSupplierPurchase: vi.fn() }));
const open = vi.fn();
const close = vi.fn();
const item: Product = {
  id: 'eq', model: 'iPhone 15 Pro', capacity: '256GB', color: 'Titanio natural', imei: '350900000300922',
  condition: 'USADO', batteryHealth: '79%', grade: 'A', price: 1800000, status: 'DISPONIBLE',
  supplierId: 'supplier', supplierName: 'Importadora Andes', stockPurchaseId: 'purchase', purchasedAt: '2026-09-05',
};
const detail = (problems = 4): InventoryItemDetail => ({ ...item, purchaseSummary: { problems, devices: 11 } });
function mount(child: ReactNode = <EquipmentDetail id="eq" />) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open, openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>{child}</DeskProvider></div>);
}
beforeEach(() => {
  vi.clearAllMocks();
  ctx.inventory = [{ ...item }];
  ctx.appSession = { store: { id: 'store' }, membership: { role: 'OWNER' } };
  vi.mocked(fetchBackendInventoryItem).mockResolvedValue(detail());
  vi.mocked(fetchSupplierPurchase).mockResolvedValue({ id: 'purchase', name: null, purchasedAt: '2026-09-05', notes: null, devices: 11, problemCount: 4, claimCount: 3, totalCost: 5000, currency: 'USD', summary: { devices: 11, problems: 4 }, items: [{ id: 'other', model: 'iPhone 14', capacity: '128GB', imei: '350900000269246', status: 'EN_REVISION', cost: 500, currency: 'USD', problem: true, problemLabel: 'En revisión', createdAt: '2026-09-05' }] });
});
it('muestra el resumen del backend y el proveedor abre su ficha', async () => {
  mount();
  expect(await screen.findByTestId('equipment-purchase-problems')).toHaveTextContent('4 de 11 equipos de esta compra tuvieron problemas');
  expect(fetchBackendInventoryItem).toHaveBeenCalledWith(ctx.user, 'eq');
  await userEvent.click(within(screen.getByTestId('equipment-supplier')).getByRole('button', { name: /Importadora Andes/ }));
  expect(open).toHaveBeenCalledWith({ type: 'supplier', id: 'supplier' });
});
it.each(['purchase', 'problems'])('abre compra desde %s y vuelve al borrador del equipo', async entry => {
  mount();
  await screen.findByTestId('equipment-purchase-problems');
  await userEvent.click(screen.getByRole('button', { name: 'En revisión' }));
  const parent = screen.getByRole('dialog');
  await userEvent.click(entry === 'purchase' ? within(screen.getByTestId('equipment-purchase')).getByRole('button', { name: '05/09/2026' }) : screen.getByTestId('equipment-purchase-problems'));
  expect(await screen.findByTestId('supplier-purchase-detail')).toHaveTextContent('350900000269246');
  expect(fetchSupplierPurchase).toHaveBeenCalledWith(ctx.user, 'supplier', 'purchase');
  await userEvent.keyboard('{Escape}');
  expect(parent).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'En revisión' })).toHaveClass('on');
  expect(close).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});
it('usa el nombre del lote y respeta el permiso financiero al abrir la compra', async () => {
  ctx.inventory = [{ ...item, purchaseName: 'Ingreso septiembre' }];
  ctx.appSession.membership.role = 'STAFF';
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Ingreso septiembre' }));
  const purchase = await screen.findByTestId('supplier-purchase-detail');
  expect(purchase).not.toHaveTextContent(/500|5\.000/);
  expect(screen.getByRole('dialog', { name: 'Ingreso septiembre' })).not.toHaveTextContent(/5\.000/);
});
it.each([0, null])('omite el aviso cuando problems=%s y conserva las filas de origen', async problems => {
  vi.mocked(fetchBackendInventoryItem).mockResolvedValue({ ...item, purchaseSummary: problems === null ? null : { problems, devices: 11 } });
  mount();
  await waitFor(() => expect(document.querySelector('.eq-purchase-problems')).toHaveAttribute('aria-busy', 'false'));
  expect(screen.queryByTestId('equipment-purchase-problems')).not.toBeInTheDocument();
  expect(screen.getByTestId('equipment-supplier')).toBeInTheDocument();
  expect(screen.getByTestId('equipment-purchase')).toBeInTheDocument();
});
it('omite el origen de equipos históricos y no consulta un resumen ficticio', () => {
  ctx.inventory = [{ ...item, supplierId: null, supplierName: null, stockPurchaseId: null, purchasedAt: null }];
  mount();
  expect(screen.queryByTestId('equipment-supplier')).not.toBeInTheDocument();
  expect(screen.queryByTestId('equipment-purchase')).not.toBeInTheDocument();
  expect(screen.queryByText(/Sin proveedor|Sin compra/)).not.toBeInTheDocument();
  expect(fetchBackendInventoryItem).not.toHaveBeenCalled();
});
it('conserva el espacio del aviso durante la espera y ante error secundario sin mensajes', async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(fetchBackendInventoryItem).mockReturnValue(new Promise((_, no) => { reject = no; }));
  mount();
  const reserved = document.querySelector('.eq-purchase-problems');
  expect(reserved).toHaveAttribute('aria-busy', 'true');
  expect(reserved?.querySelector('.skeleton')).toBeInTheDocument();
  expect(screen.queryByText(/Cargando|Reintentar/)).not.toBeInTheDocument();
  await act(async () => reject(new Error('Secondary failure')));
  expect(reserved).toHaveAttribute('aria-busy', 'false');
  expect(document.querySelector('.eq-purchase-problems')).toBe(reserved);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/Secondary failure|No hay conexión/)).not.toBeInTheDocument();
});
it('descarta respuestas tardías de otro equipo y otra tienda', async () => {
  let resolve!: (value: InventoryItemDetail) => void;
  vi.mocked(fetchBackendInventoryItem).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  vi.mocked(fetchBackendInventoryItem).mockResolvedValue(detail(0));
  const view = mount();
  ctx.inventory = [{ ...item, id: 'eq2' }];
  ctx.appSession.store.id = 'store2';
  view.rerender(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open, openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}><EquipmentDetail id="eq2" /></DeskProvider></div>);
  await waitFor(() => expect(fetchBackendInventoryItem).toHaveBeenCalledWith(ctx.user, 'eq2'));
  await act(async () => resolve(detail(4)));
  expect(screen.queryByTestId('equipment-purchase-problems')).not.toBeInTheDocument();
});
