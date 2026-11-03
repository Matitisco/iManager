import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, ClientDeposit, Product, Sale } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { ExchangeProvider } from './exchange';
import { SaleStatusPill } from './SaleStatusPill';
import { ClientPurchases } from './ClientPurchases';
import { DeskProvider } from './ui';
import type { Overlay } from './types';

const ctx = vi.hoisted(() => ({
  appSession: { user: { id: 'owner' }, store: { id: 'store' }, membership: { id: 'owner', role: 'OWNER' } },
  sales: [] as Sale[], tradeIns: [], inventory: [] as Product[], clients: [] as Client[],
  operationOptions: {}, operationDrafts: [], commissionSellers: [], creditNotes: [],
  clientDeposits: {} as Record<string, ClientDeposit[]>, loadClientDeposits: vi.fn(async () => []),
  loadOperationOptions: vi.fn(async () => undefined), fetchSaleOperation: vi.fn(async () => ({})),
  loadCommissionSellers: vi.fn(async () => undefined), createOperation: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
const close = vi.fn();
function mount(overlay: Overlay = { type: 'new-sale', productId: 'stock', clientId: 'buyer' }, currency: 'ARS' | 'USD' = 'USD') {
  return render(<ExchangeProvider settings={{ currency, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}>
    <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}><DeskOverlays overlay={overlay} /></DeskProvider>
  </ExchangeProvider>);
}
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  vi.clearAllMocks(); ctx.sales = []; ctx.clientDeposits = {};
  ctx.clients = [{ id: 'buyer', name: 'Cliente ficticio', dni: '', email: '', phone: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0 }];
  ctx.inventory = [{ id: 'stock', model: 'Equipo ficticio', capacity: '128GB', color: '', imei: '', condition: 'USADO', grade: '', batteryHealth: '', price: 500, currency: 'USD', status: 'DISPONIBLE' }];
  ctx.createOperation.mockReset().mockResolvedValue({ summary: 'Venta registrada' });
});
afterEach(() => vi.restoreAllMocks());

describe.each([390, 1440])('seña inicial en formulario a %s px', width => {
  beforeEach(() => vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: width === 390 && (query ?? '').includes('760'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
  it('ofrece la tercera opción y calcula el saldo con la moneda de la seña', async () => {
    mount();
    expect(screen.getByRole('button', { name: 'Cobrado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pendiente' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Monto de la seña')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Seña' }));
    expect(screen.queryByRole('checkbox', { name: 'Financiar en cuotas' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cobrar la primera cuota ahora')).not.toBeInTheDocument();
    change('Monto de la seña', '100,25');
    expect(screen.getByLabelText('Saldo a cobrar')).toHaveTextContent('US$ 399,75');
    await userEvent.click(within(screen.getByRole('group', { name: 'Moneda de la seña' })).getByRole('button', { name: 'ARS' }));
    change('Monto de la seña', '100000');
    expect(screen.getByLabelText('Saldo a cobrar')).toHaveTextContent('US$ 400');
    change('Precio completo de salida', '600');
    expect(screen.getByLabelText('Saldo a cobrar')).toHaveTextContent('US$ 500');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('sales', expect.objectContaining({ amount: 600, currency: 'USD', status: 'PENDIENTE', initialDeposit: { amount: 100000, currency: 'ARS' } })));
    expect(ctx.createOperation.mock.calls[0][1]).not.toHaveProperty('tenders');
    expect(ctx.createOperation.mock.calls[0][1]).not.toHaveProperty('installments');
  });

  it('permite ARS de venta con seña USD y quita la seña al volver a Pendiente', async () => {
    mount(undefined, 'ARS');
    await userEvent.click(screen.getByRole('button', { name: 'Seña' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Moneda de la seña' })).getByRole('button', { name: 'USD' }));
    change('Monto de la seña', '100,25');
    expect(screen.getByLabelText('Saldo a cobrar')).toHaveTextContent('$ 399.750');
    await userEvent.click(screen.getByRole('button', { name: 'Pendiente' }));
    expect(screen.queryByLabelText('Monto de la seña')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalled());
    expect(ctx.createOperation.mock.calls[0][1]).not.toHaveProperty('initialDeposit');
  });

  it('convive con Aplicar y descuenta ambas señas en el saldo', async () => {
    ctx.clientDeposits = { buyer: [{ id: 'old', clientId: 'buyer', amount: 50, currency: 'USD', usdAmount: 50, exchangeRate: 1000, method: 'EFECTIVO', status: 'ACTIVE', productId: null, createdAt: '2026-11-03' } as ClientDeposit] };
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Aplicar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Seña' }));
    change('Monto de la seña', '100');
    expect(screen.getByLabelText('Saldo a cobrar')).toHaveTextContent('US$ 350');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('sales', expect.objectContaining({ depositIds: ['old'], initialDeposit: { amount: 100, currency: 'USD' } })));
  });

  it('requiere cliente y bloquea cero y exceso', async () => {
    mount({ type: 'new-sale', productId: 'stock' });
    await userEvent.click(screen.getByRole('button', { name: 'Seña' }));
    expect(screen.getByText('Elegí un cliente para dejar una seña.')).toBeVisible();
    change('Monto de la seña', '100');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveAccessibleDescription('Elegí un cliente para dejar una seña');
    expect(ctx.createOperation).not.toHaveBeenCalled();
    change('Cliente', 'Cliente nuevo ficticio');
    for (const [value, error] of [['0', 'La seña debe ser mayor a cero'], ['501', 'La seña no puede superar el saldo a cobrar']]) {
      change('Monto de la seña', value);
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
      expect(screen.getByLabelText('Monto de la seña')).toHaveAccessibleDescription(error);
      expect(ctx.createOperation).not.toHaveBeenCalled();
    }
  });

  it('conserva el modal, el monto y requestKey si falla el guardado', async () => {
    ctx.createOperation.mockRejectedValueOnce(new Error('No se pudo guardar')).mockResolvedValueOnce({ summary: 'Venta registrada' });
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Seña' }));
    change('Monto de la seña', '100');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledTimes(1));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Monto de la seña')).toHaveValue('100');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(ctx.createOperation.mock.calls[1][1].requestKey).toBe(ctx.createOperation.mock.calls[0][1].requestKey);
  });
});

it('muestra Seña pendiente, Completada al cobrar y Anulada al anular sin cambiar el estado contable', () => {
  const sale: Sale = { id: 'sale', clientId: 'buyer', productId: '', date: '03/11/2026', amount: 500, status: 'PENDIENTE', paymentMethod: 'EFECTIVO', hasInitialDeposit: true };
  const view = render(<SaleStatusPill sale={sale} />);
  expect(screen.getByText('Seña')).toBeVisible(); expect(sale.status).toBe('PENDIENTE');
  view.rerender(<SaleStatusPill sale={{ ...sale, status: 'COMPLETADA' }} />);
  expect(screen.getByText('Completada')).toBeVisible();
  view.rerender(<SaleStatusPill sale={{ ...sale, voidedAt: '2026-11-03' }} />);
  expect(screen.getByText('Anulada')).toBeVisible();
});

it('identifica la seña en compras del cliente', () => {
  render(<ClientPurchases clientId="buyer" clientName="Cliente ficticio" client={ctx.clients[0]} sales={[{ id: 'sale', clientId: 'buyer', productId: 'stock', date: '03/11/2026', amount: 500, status: 'PENDIENTE', paymentMethod: 'EFECTIVO', hasInitialDeposit: true }]} tradeIns={[]} repairs={[]} inventory={ctx.inventory} sellers={[]} returns={[]} />);
  expect(screen.getByTestId('purchase-sale-sale')).toHaveTextContent('Seña · Sin vendedor');
});
