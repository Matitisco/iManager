import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AppSession } from '../types/app-session';
import type { Product } from '../types';
import { groupSession } from '../test/store-group-fixtures';
import { transferStock } from '../services/store-group-api';
import { AccessoriesScreen } from './screens/AccessoriesScreen';
import { AccessoryDetail } from './overlays/accessories';
import { InventoryScreen } from './screens/InventoryScreen';
import { ExchangeProvider } from './exchange';
import { DeskProvider } from './ui';
const ctx = vi.hoisted(() => ({
  appSession: null as AppSession | null, user: { uid: 'firebase-test' }, backendStatus: 'ready',
  inventory: [] as Product[], sales: [], suppliers: [], listsLoaded: true,
  reloadInventory: vi.fn(), deleteProduct: vi.fn(), updateProduct: vi.fn(), sectionChanges: {}, operationNotifications: [],
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/store-group-api', () => ({ transferStock: vi.fn() }));
vi.mock('../services/inventory-api', () => ({ fetchAccessorySales: vi.fn(async () => ({ sold: {} })), fetchArchivedInventory: vi.fn(async () => []) }));
const product: Product = { id: 'p', kind: 'DEVICE', model: 'Celular ficticio', cantidad: 2, imei: '', capacity: '', color: '', condition: '', grade: '', batteryHealth: '', price: 500, cost: 200, status: 'DISPONIBLE' };
let original: typeof window.matchMedia;
beforeEach(() => {
  original = window.matchMedia;
  vi.clearAllMocks(); localStorage.clear(); ctx.appSession = groupSession();
  ctx.inventory = [product, { ...product, id: 'a', kind: 'ACCESSORY', model: 'Cable ficticio', cantidad: 5 }];
  ctx.reloadInventory.mockResolvedValue(undefined);
  vi.mocked(transferStock).mockResolvedValue({ transfer: { id: 't', createdAt: '2026-11-04T12:00:00Z', from: { id: 'wholesale', name: 'Central' }, to: { id: 'retail', name: 'Local' }, items: [{ label: 'Ficticio', quantity: 1 }] } });
});
afterEach(() => { window.matchMedia = original; });
function wrap(accessory: boolean) {
  return render(<div className="desk-app"><ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}><DeskProvider value={{ tab: accessory ? 'accessories' : 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive: true }}>{accessory ? <AccessoriesScreen /> : <InventoryScreen />}</DeskProvider></ExchangeProvider></div>);
}
it.each([false, true])('transfiere desde la selección real de la pantalla (accesorios=%s)', async accessory => {
  wrap(accessory);
  fireEvent.click(screen.getByRole('checkbox', { name: `Seleccionar ${accessory ? 'Cable ficticio' : 'Celular ficticio'}` }));
  const bulk = screen.getByRole('region', { name: 'Acciones masivas' });
  fireEvent.click(within(bulk).getByRole('button', { name: 'Transferir a Local ficticio' }));
  const sheet = screen.getByRole('dialog', { name: 'Transferir a Local ficticio' });
  // The sheet belongs to the app surface, outside the mobile bulk bar's layout rules.
  expect(sheet.closest('.bulk-buttons')).toBeNull(); expect(sheet.closest('.desk-app')).not.toBeNull();
  fireEvent.click(within(sheet).getByRole('button', { name: 'Transferir' }));
  await waitFor(() => expect(transferStock).toHaveBeenCalledWith(ctx.user, expect.objectContaining({ toStoreId: 'retail', items: [{ inventoryItemId: accessory ? 'a' : 'p', quantity: 1 }] })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(ctx.reloadInventory).toHaveBeenCalledOnce();
  expect(screen.queryByRole('region', { name: 'Acciones masivas' })).not.toBeInTheDocument();
});
it('permite seleccionar accesorios desde móvil', async () => {
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: String(query).includes('760'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  wrap(true); fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar Cable ficticio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Transferir a Local ficticio' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('spinbutton', { name: 'Cantidad de Cable ficticio' })).toHaveAttribute('max', '5');
});

it('bloquea restaurar accesorios transferidos con una explicación visible', () => {
  ctx.inventory = [{ ...product, id: 'a', kind: 'ACCESSORY', cantidad: 0, archivedAt: '2026-11-04', archiveReason: 'Transferido a Local ficticio' }];
  render(<div className="desk-app"><ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}><DeskProvider value={{ tab: 'accessories', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive: true }}><AccessoryDetail id="a" /></DeskProvider></ExchangeProvider></div>);
  expect(screen.getByRole('button', { name: 'Restaurar' })).toBeDisabled();
  expect(screen.getByText(/Para devolverlo, transferilo desde la otra tienda/)).toBeVisible();
});
