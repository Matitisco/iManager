import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { AccessoriesScreen } from './screens/AccessoriesScreen';
import { EquipmentForm } from './overlays/equipment';
import { EquipmentField } from './EquipmentField';
import { ExchangeProvider } from './exchange';
import { DeskProvider } from './ui';
import { desktopNav } from './nav';
import { tabFromHash } from './hash-route';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[], sales: [], suppliers: [], user: { uid: 'test-user' },
  appSession: { store: { id: 'ficticio' }, membership: { role: 'OWNER', sections: ['inventory'] } },
  addProduct: vi.fn(), updateProduct: vi.fn(), listsLoaded: true,
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/inventory-api', () => ({ fetchAccessorySales: vi.fn(async () => ({ month: '2026-11', sold: { cable: 3 } })), fetchArchivedInventory: vi.fn(async () => []) }));
const open = vi.fn();
function wrap(children: React.ReactNode) {
  return render(<ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}><DeskProvider value={{ tab: 'accessories', open, close: vi.fn(), go: vi.fn(), openRecord: vi.fn(), toast: vi.fn(), isStaff: false }}>{children}</DeskProvider></ExchangeProvider>);
}
const cable: Product = { id: 'cable', kind: 'ACCESSORY', model: 'Cable USB-C ficticio', accessoryType: 'Cable', compatibleWith: 'Pixel ficticio', cantidad: 2, imei: '', capacity: '', color: '', condition: '', grade: '', batteryHealth: '', cost: 1800.25, costValue: 3600.50, price: 6000.50, currency: 'ARS', status: 'DISPONIBLE' };
beforeEach(() => {
  vi.clearAllMocks(); ctx.inventory = [cable, { ...cable, id: 'device', kind: 'DEVICE', model: 'Celular ficticio', cantidad: 1 }];
  ctx.appSession.membership = { role: 'OWNER', sections: ['inventory'] };
  ctx.addProduct.mockResolvedValue({ id: 'created' }); ctx.updateProduct.mockResolvedValue(undefined);
});

it('agrega Accesorios debajo de Equipos con el mismo permiso Stock', () => {
  const nav = desktopNav(['inventory'], 'MANAGER');
  const stock = nav.main.find(block => block.kind === 'group' && block.id === 'stock');
  expect(stock?.kind === 'group' && stock.items.slice(0, 2).map(item => item.id)).toEqual(['inventory', 'accessories']);
  expect(desktopNav(['sales'], 'MANAGER').main.some(block => block.kind === 'group' && block.id === 'stock')).toBe(false);
  expect(tabFromHash('#/stock/accesorios')).toBe('accessories');
});

it('muestra solo accesorios, poco stock, vendidos del mes y busca compatibilidad', async () => {
  wrap(<AccessoriesScreen />);
  expect(screen.queryByText('Celular ficticio')).not.toBeInTheDocument();
  expect(screen.getByText('Poco stock')).toBeVisible();
  await waitFor(() => expect(screen.getByText('Vendidos este mes').parentElement).toHaveTextContent('3'));
  fireEvent.change(screen.getByPlaceholderText('Buscar accesorio o modelo'), { target: { value: 'Pixel' } });
  expect(screen.getByText(cable.model)).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText('Buscar accesorio o modelo'), { target: { value: 'inexistente' } });
  expect(screen.getByText('No encontramos accesorios con esa búsqueda.')).toBeVisible();
});

it('oculta las columnas y tarjetas financieras usando canSeeFinancials', () => {
  ctx.appSession.membership = { role: 'MANAGER', sections: ['inventory'] };
  wrap(<AccessoriesScreen />);
  expect(screen.queryByText('Valor al costo')).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Costo' })).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Precio' })).toBeVisible();
});

it('segmenta Celular/Accesorio y guarda cantidad/céntimos sin campos de celular', async () => {
  ctx.inventory = [];
  wrap(<EquipmentForm busy={false} error={null} run={async action => { await action(); }} />);
  expect(screen.getByRole('group', { name: 'Tipo de producto' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Accesorio' }));
  const sheet = screen.getByRole('dialog', { name: 'Registrar' });
  expect(within(sheet).queryByText(/IMEI/)).not.toBeInTheDocument();
  expect(within(sheet).queryByText('Batería %')).not.toBeInTheDocument();
  expect(within(sheet).queryByText('Condición')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Funda ficticia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Funda' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad' }), { target: { value: '0' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Costo unitario' }), { target: { value: '1800,25' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Precio de venta' }), { target: { value: '6000,50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar accesorio' }));
  await waitFor(() => expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ACCESSORY', model: 'Funda ficticia', accessoryType: 'Funda', cantidad: 0, cost: 1800.25, price: 6000.50, imei: '', batteryHealth: '', condition: '' })));
});

it('no envía costo sin permiso y valida cantidades enteras antes de persistir', async () => {
  ctx.appSession.membership = { role: 'MANAGER', sections: ['inventory'] }; ctx.inventory = [];
  wrap(<EquipmentForm initialKind="ACCESSORY" busy={false} error={null} run={async action => { await action(); }} />);
  expect(screen.queryByRole('textbox', { name: 'Costo unitario' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Nombre' }), { target: { value: 'Templado ficticio' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad' }), { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar accesorio' }));
  expect(screen.getByRole('alert')).toHaveTextContent('cantidad entera'); expect(ctx.addProduct).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad' }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar accesorio' }));
  await waitFor(() => expect(ctx.addProduct).toHaveBeenCalled());
  expect(ctx.addProduct.mock.calls[0][0]).not.toHaveProperty('cost');
});

it('la búsqueda de venta incluye accesorios y muestra sus unidades disponibles', () => {
  const pick = vi.fn();
  wrap(<EquipmentField items={[cable]} value="Cable" linked={false} onValue={vi.fn()} onPick={pick} />);
  fireEvent.focus(screen.getByRole('combobox'));
  const option = screen.getByRole('option');
  expect(option).toHaveTextContent('Cable USB-C ficticio');
  expect(option).toHaveTextContent('Accesorio · 2 u. disponibles');
  fireEvent.mouseDown(option);
  expect(pick).toHaveBeenCalledWith(cable);
});
