import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, RepairOrder, Sale } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';
import { formatArDate } from './format';

const ctx = vi.hoisted(() => ({
  clients: [] as Client[],
  sales: [] as Sale[],
  repairOrders: [] as RepairOrder[],
  inventory: [] as Product[],
  tradeIns: [],
  operationDrafts: [],
  operationOptions: {},
  user: null as null,
  appSession: {
    store: { id: 's', name: 'Casa', usedWarrantyDays: 15, sealedWarrantyDays: 45, repairWarrantyDays: 8, timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS' },
    membership: { role: 'OWNER' as const },
    user: { id: 'u', displayName: 'Ana', email: 'ana@test.com' },
  },
  loadOperationOptions: vi.fn(async () => undefined),
  createOperation: vi.fn(async () => ({ summary: 'ok' })),
  updateSaleOperation: vi.fn(),
  updateTradeOperation: vi.fn(),
  confirmTradeOperation: vi.fn(),
  fetchSaleOperation: vi.fn(),
  fetchTradeOperation: vi.fn(),
  updateStore: vi.fn(),
  registerClientPayment: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../services/clients-api', () => ({ fetchClientPayments: vi.fn(async () => []) }));

const desk = {
  tab: 'settings' as const,
  go: vi.fn(),
  open: vi.fn(),
  openRecord: vi.fn(),
  close: vi.fn(),
  toast: vi.fn(),
  isStaff: false,
};

function phoneMedia(phone: boolean) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: phone && String(query).includes('760'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return () => { window.matchMedia = original; };
}

const client: Client = {
  id: 'c1', dni: '', name: 'Ana Gómez', email: '', phone: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0,
};
const product: Product = {
  id: 'p1', imei: '350000000000001', model: 'iPhone 13', capacity: '128GB', color: 'Azul', condition: 'NUEVO', grade: '', batteryHealth: '100%', price: 200, status: 'VENDIDO',
};

describe('warranty screens', () => {
  afterEach(() => cleanup());

  it.each([false, true])('shows whether the client device is covered (phone: %s)', (phone) => {
    const restore = phoneMedia(phone);
    ctx.clients = [client];
    ctx.sales = [{
      id: 's1', date: formatArDate(new Date()), clientId: 'c1', productId: 'p1', deviceLabel: 'iPhone 13',
      amount: 200, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', warrantyDays: 30,
    }];
    ctx.repairOrders = [];
    ctx.inventory = [product];
    render(<DeskProvider value={desk}><DeskOverlays overlay={{ type: 'cl', id: 'c1' }} /></DeskProvider>);
    const block = screen.getByTestId('client-purchases');
    expect(block).toBeVisible();
    expect(block).toHaveTextContent('iPhone 13');
    expect(block).toHaveTextContent(/Vigente/);
    expect(screen.queryByRole('region', { name: 'Garantías' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cubierto')).not.toBeInTheDocument();
    restore();
  });

  it.each([false, true])('shows IMEI coverage on the device sheet (phone: %s)', (phone) => {
    const restore = phoneMedia(phone);
    ctx.inventory = [product];
    ctx.sales = [{
      id: 's1', date: '01/01/2020', clientId: 'c1', productId: 'p1', deviceLabel: 'iPhone 13',
      amount: 200, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', warrantyDays: 1,
    }];
    ctx.repairOrders = [{
      id: 'r1', orderNumber: 1, code: 'OT-0001', clientId: 'c1', clientName: 'Ana', clientPhone: '',
      device: 'iPhone 13', imei: '350000000000001', fault: 'Batería', faultTags: [], estimate: 1000, deposit: 0,
      technician: '', status: 'RECIBIDO', estimatedDelivery: null, notifyWhatsapp: false, receivedAt: '01/10/2026',
      whatsappUrl: null, warrantyDays: 8, events: [{ id: 'e', status: 'RECIBIDO', createdAt: '01/10/2026' }],
    }];
    render(<DeskProvider value={desk}><DeskOverlays overlay={{ type: 'eq', id: 'p1' }} /></DeskProvider>);
    const block = screen.getByTestId('device-warranties');
    expect(block).toBeVisible();
    expect(block).toHaveTextContent('Garantía al entregar');
    expect(block).toHaveTextContent('Venció el');
    expect(block).toHaveTextContent('empieza al entregar');
    restore();
  });

  it.each([false, true])('prefills sealed warranty days on a phone-sized sale form (phone: %s)', async (phone) => {
    const restore = phoneMedia(phone);
    ctx.inventory = [{ ...product, status: 'DISPONIBLE' }];
    ctx.sales = [];
    ctx.repairOrders = [];
    render(<DeskProvider value={desk}><DeskOverlays overlay={{ type: 'new-sale', source: 'inventory', productId: 'p1' }} /></DeskProvider>);
    const days = await screen.findByTestId('sale-warranty-days');
    expect(days).toBeVisible();
    await waitFor(() => expect(days).toHaveValue('45'));
    expect(screen.getByRole('button', { name: 'Otro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sale-warranty-until')).toHaveTextContent(/^Vence el \d{2}\/\d{2}\/\d{4}$/);
    expect(screen.getByLabelText('Fecha de la venta')).toBeVisible();
    restore();
  });

  it('uses 30 days for used devices, 90 for sealed, and Otro for anything else', async () => {
    const user = userEvent.setup();
    ctx.appSession.store.usedWarrantyDays = 30;
    ctx.appSession.store.sealedWarrantyDays = 90;
    ctx.inventory = [{ ...product, condition: 'USADO', status: 'DISPONIBLE' }];
    ctx.sales = [];
    render(<DeskProvider value={desk}><DeskOverlays overlay={{ type: 'new-sale', source: 'inventory', productId: 'p1' }} /></DeskProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.queryByTestId('sale-warranty-days')).not.toBeInTheDocument();
    expect(screen.getByTestId('sale-warranty-until')).toHaveTextContent(/^Vence el /);
    await user.click(screen.getByRole('button', { name: '60 días' }));
    expect(screen.getByRole('button', { name: '60 días' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Otro' }));
    const days = screen.getByTestId('sale-warranty-days');
    expect(days).toHaveValue('');
    await user.type(days, '45');
    expect(screen.getByRole('button', { name: 'Otro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sale-warranty-until')).toHaveTextContent(/^Vence el \d{2}\/\d{2}\/\d{4}$/);
    ctx.appSession.store.usedWarrantyDays = 15;
    ctx.appSession.store.sealedWarrantyDays = 45;
  });

  it('saves warranty defaults from settings', async () => {
    const user = userEvent.setup();
    ctx.updateStore.mockReset();
    ctx.updateStore.mockResolvedValue(undefined);
    render(<DeskProvider value={desk}><DeskOverlays overlay={{ type: 'warranty' }} /></DeskProvider>);
    expect(screen.getByTestId('warranty-used-days')).toHaveValue('15');
    await user.clear(screen.getByTestId('warranty-sealed-days'));
    await user.type(screen.getByTestId('warranty-sealed-days'), '120');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(ctx.updateStore).toHaveBeenCalledWith({ usedWarrantyDays: 15, sealedWarrantyDays: 120, repairWarrantyDays: 8 }));
  });
});
