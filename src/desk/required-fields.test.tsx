import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  clients: [] as Client[],
  sales: [],
  tradeIns: [] as TradeIn[],
  operationDrafts: [],
  operationOptions: {},
  inventory: [] as Product[],
  addClient: vi.fn(),
  updateClient: vi.fn(),
  addTradeIn: vi.fn(),
  loadOperationOptions: vi.fn(),
  createOperation: vi.fn(),
  updateTradeIn: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    dni: '',
    name: 'Ana Gómez',
    email: '',
    phone: '',
    lastPurchaseDate: 'N/A',
    totalSpent: 0,
    pendingBalance: 0,
    ...overrides,
  };
}

function product(): Product {
  return {
    id: 'prod-1',
    imei: '',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Azul',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: 200,
    status: 'DISPONIBLE',
  };
}

function renderOverlay(type: 'new-cl' | 'new-cj') {
  return render(
    <DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={{ type }} />
    </DeskProvider>,
  );
}

describe('desk required fields', () => {
  beforeEach(() => {
    ctx.clients = [];
    ctx.tradeIns = [];
    ctx.inventory = [];
    ctx.operationOptions = {};
    ctx.loadOperationOptions.mockReset();
    ctx.loadOperationOptions.mockResolvedValue(undefined);
    ctx.createOperation.mockReset();
    ctx.createOperation.mockResolvedValue({ summary: 'Canje confirmado' });
    ctx.addClient.mockReset();
    ctx.addClient.mockResolvedValue({ id: 'new-client' });
    ctx.addTradeIn.mockReset();
    ctx.addTradeIn.mockResolvedValue(undefined);
  });

  it('saves a client with only a name', async () => {
    const user = userEvent.setup();
    renderOverlay('new-cl');

    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    expect(screen.getByText('Completá este dato')).toBeInTheDocument();
    expect(ctx.addClient).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('Ej. Ana Gómez'), 'Ana Gómez');
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => expect(ctx.addClient).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ana Gómez',
      dni: '',
      phone: '',
      email: '',
    })));
  });

  it('confirms a trade-in without requiring an imei', async () => {
    const user = userEvent.setup();
    ctx.clients = [client()];
    ctx.inventory = [product()];
    renderOverlay('new-cj');

    const fields = screen.getAllByRole('combobox');
    await user.type(fields[0], 'Visitante');
    await user.type(screen.getByLabelText('Equipo recibido'), 'iPhone 11 64GB');
    await user.type(screen.getByLabelText('Valor tomado'), '100');
    await user.type(fields[1], 'Equipo de salida');
    const salePrice = screen.getByLabelText('Precio completo de salida');
    await user.type(salePrice, '50');
    await user.click(screen.getByRole('button', { name: 'Confirmar canje' }));
    expect(screen.getByText('El precio de salida no puede ser menor que el valor tomado')).toBeInTheDocument();
    expect(ctx.createOperation).not.toHaveBeenCalled();

    await user.clear(salePrice);
    await user.type(salePrice, '200');
    await user.click(screen.getByRole('button', { name: 'Confirmar canje' }));

    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('tradeins', expect.objectContaining({
      clientId: null,
      clientName: 'Visitante',
      productId: null,
      deviceLabel: 'Equipo de salida',
      amount: 200,
      draft: false,
      tradeIn: expect.objectContaining({
        deviceReceived: 'iPhone 11 64GB',
        takeValue: 100,
      }),
    })));
  });

  it('links a trade-in client when a suggestion is picked', async () => {
    const user = userEvent.setup();
    ctx.clients = [client(), client({ id: 'client-2', name: 'Bruno D\u00edaz', phone: '11 5555', dni: '30111222' })];
    ctx.inventory = [product()];
    renderOverlay('new-cj');

    const fields = screen.getAllByRole('combobox');
    await user.type(fields[0], '3011');
    await user.click(screen.getByRole('option', { name: /Bruno D\u00edaz/ }));
    await user.type(screen.getByLabelText('Equipo recibido'), 'iPhone 11 64GB');
    await user.type(screen.getByLabelText('Valor tomado'), '100');
    await user.type(fields[1], 'Equipo de salida');
    await user.type(screen.getByLabelText('Precio completo de salida'), '200');
    await user.click(screen.getByRole('button', { name: 'Confirmar canje' }));

    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('tradeins', expect.objectContaining({
      clientId: 'client-2',
      clientName: 'Bruno D\u00edaz',
      amount: 200,
      draft: false,
      tradeIn: expect.objectContaining({ deviceReceived: 'iPhone 11 64GB', takeValue: 100 }),
    })));
  });

  it('asks for a sale price when the equipment has no list price', async () => {
    const user = userEvent.setup();
    ctx.inventory = [{ ...product(), id: 'prod-0', model: 'iPhone recibido', price: 0, status: 'VENDIDO', pendingSaleRegistration: true }];
    render(
      <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
        <DeskOverlays overlay={{ type: 'new-sale', productId: 'prod-0', source: 'inventory' }} />
      </DeskProvider>,
    );

    expect(screen.getByText('Este equipo no tiene precio. Completá el precio de salida para registrar la venta.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    expect(screen.getByText('Completá el precio de salida')).toBeInTheDocument();
    expect(ctx.createOperation).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('$ 0'), '1800');
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('inventory', expect.objectContaining({
      productId: 'prod-0',
      amount: 1800,
      draft: false,
    })));
  });
});
