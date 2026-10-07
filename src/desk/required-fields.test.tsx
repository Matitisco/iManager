import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, TradeIn } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  clients: [] as Client[],
  tradeIns: [] as TradeIn[],
  inventory: [] as Product[],
  addClient: vi.fn(),
  updateClient: vi.fn(),
  addTradeIn: vi.fn(),
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
    <DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={{ type }} />
    </DeskProvider>,
  );
}

describe('desk required fields', () => {
  beforeEach(() => {
    ctx.clients = [];
    ctx.tradeIns = [];
    ctx.inventory = [];
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

  it('saves a trade-in without an imei', async () => {
    const user = userEvent.setup();
    ctx.clients = [client()];
    ctx.inventory = [product()];
    renderOverlay('new-cj');

    await user.click(screen.getByRole('button', { name: 'Crear canje' }));
    expect(screen.getAllByText('Completá este dato')).toHaveLength(2);
    expect(ctx.addTradeIn).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('Escribí el nombre o elegí un cliente'), 'Visitante');
    expect(screen.getByText(/Se guarda como texto/)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Ej. iPhone 11 64GB'), 'iPhone 11 64GB');
    await user.type(screen.getByPlaceholderText('15 dígitos'), '123');
    await user.click(screen.getByRole('button', { name: 'Crear canje' }));
    expect(screen.getByText('El IMEI tiene 15 dígitos')).toBeInTheDocument();
    expect(ctx.addTradeIn).not.toHaveBeenCalled();

    await user.clear(screen.getByPlaceholderText('15 dígitos'));
    await user.click(screen.getByRole('button', { name: 'Crear canje' }));

    await waitFor(() => expect(ctx.addTradeIn).toHaveBeenCalledWith(expect.objectContaining({
      clientId: '',
      clientName: 'Visitante',
      deviceReceived: 'iPhone 11 64GB',
      deviceReceivedImei: '',
      deviceGiven: 'iPhone 13 128GB',
    })));
  });

  it('links a trade-in client when a suggestion is picked', async () => {
    const user = userEvent.setup();
    ctx.clients = [client(), client({ id: 'client-2', name: 'Bruno Díaz', phone: '11 5555', dni: '30111222' })];
    ctx.inventory = [product()];
    renderOverlay('new-cj');

    await user.type(screen.getByPlaceholderText('Escribí el nombre o elegí un cliente'), '3011');
    await user.click(screen.getByRole('option', { name: /Bruno Díaz/ }));
    expect(screen.queryByText(/Se guarda como texto/)).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Ej. iPhone 11 64GB'), 'iPhone 11 64GB');
    await user.click(screen.getByRole('button', { name: 'Crear canje' }));

    await waitFor(() => expect(ctx.addTradeIn).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-2',
      clientName: 'Bruno Díaz',
      deviceReceived: 'iPhone 11 64GB',
    })));
  });
});
