import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { ExchangeProvider } from './exchange';
import type { Overlay } from './types';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  appSession: { user: { id: 'user-owner' }, store: { id: 'store' }, membership: { id: 'owner-member' as string | undefined, role: 'OWNER', sections: null as string[] | null } },
  sales: [] as Sale[], tradeIns: [] as TradeIn[], inventory: [] as Product[], clients: [],
  operationOptions: {}, operationDrafts: [],
  commissionSellers: [{ id: 'seller', name: 'Ana Vendedora', role: 'STAFF' }],
  loadOperationOptions: vi.fn(), fetchSaleOperation: vi.fn(), fetchTradeOperation: vi.fn(),
  loadCommissionSellers: vi.fn(), createOperation: vi.fn(), updateSaleOperation: vi.fn(), confirmTradeOperation: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
const close = vi.fn();
const open = vi.fn();
const original: Sale = {
  id: 'sale', date: '11/10/2026', clientId: 'client', clientName: 'Ana Pérez', productId: 'product',
  deviceLabel: 'iPhone 14 128GB', amount: 1500.31, amountCurrency: 'USD', paymentMethod: 'EFECTIVO',
  status: 'COMPLETADA', integratedOperation: true, tradeInId: null,
};
function mount(overlay: Overlay = { type: 'edit-sale', id: 'sale' }, active: 'ARS' | 'USD' = 'ARS') {
  const form = () => <ExchangeProvider settings={{ currency: active, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1190, manualSell: 1234.56 }}>
    <DeskProvider value={{ tab: 'sales', go: vi.fn(), open, openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={overlay} />
    </DeskProvider>
  </ExchangeProvider>;
  const view = render(form());
  return { ...view, refresh: () => view.rerender(form()) };
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.appSession.membership.id = 'owner-member';
  ctx.appSession.membership.role = 'OWNER'; ctx.appSession.membership.sections = null;
  ctx.commissionSellers = [
    { id: 'seller', name: 'Ana Vendedora', role: 'STAFF' },
    { id: 'owner-member', name: 'Nico', role: 'OWNER' },
  ];
  ctx.operationOptions = {};
  ctx.sales = [{ ...original }]; ctx.tradeIns = [];
  ctx.inventory = [{ id: 'product', model: 'iPhone 14', capacity: '128GB', color: 'Azul', imei: '', condition: 'USADO', grade: 'A', batteryHealth: '90%', cost: 900, price: 1500.31, currency: 'USD', status: 'VENDIDO' }];
  ctx.loadOperationOptions.mockResolvedValue(undefined);
  ctx.fetchSaleOperation.mockResolvedValue({}); ctx.fetchTradeOperation.mockResolvedValue({});
  ctx.loadCommissionSellers.mockResolvedValue(undefined);
  ctx.createOperation.mockResolvedValue({ summary: 'Venta registrada' });
  ctx.updateSaleOperation.mockResolvedValue({ summary: 'Operación actualizada' });
});
afterEach(() => vi.restoreAllMocks());


describe.each([390, 1440])('costo en venta a %s px', width => {
  beforeEach(() => {
    const media = window.matchMedia('(max-width: 760px)');
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...media, media: query, matches: width === 390 && query.includes('760') }));
  });
  it('precarga el costo en moneda del equipo y actualiza ganancia en vivo', async () => {
    mount(undefined, 'USD');
    expect(screen.getByRole('textbox', { name: 'Costo de compra' })).toHaveValue('900');
    expect(screen.getByLabelText('Ganancia')).toHaveTextContent('US$ 600,31');
    fireEvent.change(screen.getByRole('textbox', { name: 'Costo de compra' }), { target: { value: '1000,12' } });
    expect(screen.getByLabelText('Ganancia')).toHaveTextContent('US$ 500,19');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalledWith('sale', expect.objectContaining({ cost: 1000.12 })));
  });
  it('editar sin tocar costo no envía el prefill', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalled());
    expect(ctx.updateSaleOperation.mock.calls[0][1]).not.toHaveProperty('cost');
  });
  it('vaciar no envía costo ni pisa el existente', async () => {
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Costo de compra' }), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalled());
    expect(ctx.updateSaleOperation.mock.calls[0][1]).not.toHaveProperty('cost');
  });
  it('carga costo de un encargue nuevo y lo envía junto al equipo', async () => {
    ctx.sales = []; ctx.inventory = [];
    mount({ type: 'new-sale' }, 'USD');
    expect(screen.getByLabelText('Equipo')).toHaveAttribute('role', 'combobox');
    fireEvent.change(screen.getByLabelText('Equipo'), { target: { value: 'Equipo por encargue' } });
    fireEvent.change(screen.getByLabelText('Precio completo de salida'), { target: { value: '1500' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Costo de compra' }), { target: { value: '900,25' } });
    expect(screen.getByLabelText('Ganancia')).toHaveTextContent('US$ 599,75');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('sales', expect.objectContaining({ cost: 900.25, unlistedEquipment: expect.objectContaining({ model: 'Equipo por encargue' }) })));
  });
  it('retirar Reportes después de escribir impide enviar costo', async () => {
    const view = mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Costo de compra' }), { target: { value: '1100' } });
    ctx.appSession.membership.role = 'MANAGER'; ctx.appSession.membership.sections = ['sales'];
    view.refresh();
    expect(screen.queryByLabelText('Costo de compra')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateSaleOperation).toHaveBeenCalled());
    expect(ctx.updateSaleOperation.mock.calls[0][1]).not.toHaveProperty('cost');
  });
  it.each([['MANAGER', false], ['STAFF', true]])('respeta permiso financiero de %s sin Reportes (#691)', (role, visible) => {
    ctx.appSession.membership.role = role as string;
    ctx.appSession.membership.sections = ['sales'];
    mount();
    expect(Boolean(screen.queryByRole('textbox', { name: 'Costo de compra' }))).toBe(visible);
    expect(Boolean(screen.queryByLabelText('Ganancia'))).toBe(visible);
  });
  it('precarga opciones de equipo sin depender del inventario completo', () => {
    ctx.sales = []; ctx.inventory[0].status = 'DISPONIBLE';
    ctx.operationOptions = { sales: { products: [{ ...ctx.inventory[0], cost: 850.25 }], clients: [] } };
    ctx.inventory = [];
    mount({ type: 'new-sale', productId: 'product' }, 'USD');
    expect(screen.getByRole('textbox', { name: 'Costo de compra' })).toHaveValue('850,25');
    ctx.operationOptions = {};
  });
});
