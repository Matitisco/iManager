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
    expect(screen.getByLabelText('Diferencia')).toHaveValue('');
    expect(screen.getByText('El precio de salida no puede ser menor que el valor tomado')).toBeInTheDocument();
    expect(screen.queryByText(/Diferencia a cobrar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$\s*-/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar canje' }));
    expect(screen.getAllByText('El precio de salida no puede ser menor que el valor tomado').length).toBeGreaterThan(0);
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
      unlistedEquipment: expect.objectContaining({
        model: 'Equipo de salida',
        price: 200,
      }),
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

  it('focuses and describes the first invalid field on every attempt without clearing the draft', async () => {
    const user = userEvent.setup();
    renderOverlay('new-cj');
    const client = screen.getByRole('combobox', { name: 'Cliente' });
    const confirm = screen.getByRole('button', { name: 'Confirmar canje' });
    await user.type(screen.getByLabelText('Equipo recibido'), 'iPhone 11');
    await user.click(confirm);
    expect(client).toHaveFocus();
    expect(client).toHaveAttribute('aria-invalid', 'true');
    expect(client).toHaveAccessibleDescription('Completá el nombre del cliente');
    await user.click(confirm);
    expect(client).toHaveFocus();
    await user.type(client, 'Ana');
    await user.click(confirm);
    expect(screen.getByRole('combobox', { name: 'Equipo' })).toHaveFocus();
    expect(client).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Equipo recibido')).toHaveValue('iPhone 11');
    expect(ctx.createOperation).not.toHaveBeenCalled();
  });

  it('keeps an unconfirmed sale total neutral when entering a partial payment', async () => {
    const user = userEvent.setup();
    render(<DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={{ type: 'new-sale' }} />
    </DeskProvider>);
    expect(screen.queryByText('Venta cobrada')).not.toBeInTheDocument();
    expect(screen.queryByText(/Total a cobrar/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Precio completo de salida'), '800');
    await user.click(screen.getByRole('checkbox', { name: 'Combinar pagos' }));
    await user.type(screen.getByLabelText('Importe del pago 1'), '300');
    expect(screen.getByText('Total a cobrar: $ 800')).toBeInTheDocument();
    expect(screen.queryByText('Venta cobrada')).not.toBeInTheDocument();
  });

  it('clears the missing price error when picking a stocked device that supplies its price', async () => {
    const user = userEvent.setup();
    ctx.operationOptions = { sales: { products: [product()], clients: [] } };
    render(<DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={{ type: 'new-sale' }} />
    </DeskProvider>);
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    expect(screen.getByText('Completá el precio de salida')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Equipo' }), 'iPhone');
    await user.click(screen.getByRole('option', { name: /iPhone 13/ }));
    expect(screen.getByLabelText('Precio completo de salida')).toHaveValue('200');
    expect(screen.queryByText('Completá el precio de salida')).not.toBeInTheDocument();
  });

  it.each([0, null])('asks for a sale price when the equipment has no list price (%s)', async price => {
    const user = userEvent.setup();
    ctx.inventory = [{ ...product(), id: 'prod-0', model: 'iPhone recibido', price, status: 'VENDIDO', pendingSaleRegistration: true }];
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

  it.each([null, 200])('shows unit price and total for five units (list price: %s)', async price => {
    const user = userEvent.setup();
    ctx.inventory = [{ ...product(), cantidad: 10, price }];
    render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={{ type: 'new-sale', productId: 'prod-1', source: 'inventory' }} />
    </DeskProvider>);
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '5');
    expect(screen.queryByLabelText('Precio completo de salida')).not.toBeInTheDocument();
    const unit = screen.getByLabelText('Precio por unidad');
    if (price != null) expect(unit).toHaveValue('200');
    else await user.type(unit, '200');
    expect(screen.getByLabelText('Total')).toHaveTextContent('$ 1.000');
    expect(screen.getByText('Total a cobrar: $ 1.000')).toBeInTheDocument();
    await user.clear(unit);
    await user.type(unit, '250');
    expect(screen.getByLabelText('Total')).toHaveTextContent('$ 1.250');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '3');
    expect(screen.getByLabelText('Total')).toHaveTextContent('$ 750');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '5');
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('inventory', expect.objectContaining({ cantidad: 5, amount: 1250, unitPrice: 250 })));
  });

  it('keeps the single-unit label, price and payload when returning from multiple units', async () => {
    const user = userEvent.setup();
    ctx.inventory = [{ ...product(), cantidad: 10 }];
    render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={{ type: 'new-sale', productId: 'prod-1', source: 'inventory' }} />
    </DeskProvider>);
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '5');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '1');
    expect(screen.getByLabelText('Precio completo de salida')).toHaveValue('200');
    expect(screen.queryByLabelText('Total')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalled());
    const payload = ctx.createOperation.mock.calls[0][1];
    expect(payload).toMatchObject({ cantidad: 1, amount: 200 });
    expect(payload).not.toHaveProperty('unitPrice');
  });

  it('asks for the sale price instead of a negative trade difference and creates the missing device', async () => {
    const user = userEvent.setup();
    renderOverlay('new-cj');

    await user.type(screen.getByLabelText('Equipo recibido'), 'iPhone 11');
    await user.type(screen.getByLabelText('Valor tomado'), '500');
    await user.type(screen.getByRole('combobox', { name: 'Equipo' }), 'Pixel libre');
    expect(screen.getByTestId('unlisted-equipment')).toBeInTheDocument();
    expect(screen.getByLabelText('Diferencia')).toHaveValue('');
    expect(screen.getByText('Completá el precio de salida para calcular la diferencia')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar canje' }));
    expect(ctx.createOperation).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Capacidad'), '128GB');
    await user.type(screen.getByLabelText('Color'), 'Verde');
    await user.click(screen.getByRole('button', { name: 'Usado' }));
    await user.type(screen.getByLabelText('Precio completo de salida'), '900');
    await user.type(screen.getByLabelText('Cliente'), 'Mostrador');
    await user.click(screen.getByRole('button', { name: 'Confirmar canje' }));

    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('tradeins', expect.objectContaining({
      productId: null,
      deviceLabel: 'Pixel libre',
      amount: 900,
      draft: false,
      unlistedEquipment: {
        model: 'Pixel libre',
        capacity: '128GB',
        color: 'Verde',
        condition: 'USADO',
        imei: null,
        price: 900,
      },
    })));
    expect(screen.getByLabelText('Diferencia')).toHaveValue('$ 400');
  });

  it('keeps the basic device fields visible on a phone sale', async () => {
    const user = userEvent.setup();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(
      <DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
        <DeskOverlays overlay={{ type: 'new-sale', source: 'sales' }} />
      </DeskProvider>,
    );

    await user.type(screen.getByRole('combobox', { name: 'Equipo' }), 'Equipo suelto');
    const basics = screen.getByTestId('unlisted-equipment');
    expect(basics).toBeVisible();
    expect(basics).toHaveTextContent('Capacidad');
    expect(screen.getByTestId('sale-trade-fold')).not.toContainElement(basics);
    window.matchMedia = originalMatchMedia;
  });
});
