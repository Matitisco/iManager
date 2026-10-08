import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Accessory, Product } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { InventoryScreen } from './screens/InventoryScreen';
import { DeskProvider } from './ui';

const open = vi.fn();
const ctx = vi.hoisted(() => ({
  inventory: [] as Product[],
  accessories: [] as Accessory[],
  clients: [],
  sales: [],
  tradeIns: [],
  operationDrafts: [],
  operationOptions: {},
  appSession: { store: { name: 'Tienda Centro' } },
  loadOperationOptions: vi.fn(),
  createOperation: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

function product(): Product {
  return {
    id: 'eq-1',
    imei: '350000000000010',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Medianoche',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '89%',
    cost: 400000,
    price: 650000,
    status: 'DISPONIBLE',
  };
}

function accessory(overrides: Partial<Accessory> & Pick<Accessory, 'id' | 'name' | 'stock' | 'minStock'>): Accessory {
  return {
    category: 'Fundas',
    compatibleWith: '',
    sku: '',
    cost: 0,
    price: 0,
    ...overrides,
  };
}

function renderInventory() {
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <InventoryScreen />
    </DeskProvider>,
  );
}

describe('desk accessories', () => {
  beforeEach(() => {
    open.mockReset();
    ctx.inventory = [product()];
    ctx.accessories = [
      accessory({ id: 'ok', name: 'Cargador 20W USB-C', category: 'Cargadores', sku: 'CAR-20W', stock: 14, minStock: 5, cost: 9000, price: 18000 }),
      accessory({ id: 'low', name: 'Cable USB-C a Lightning 1 m', category: 'Cables', sku: 'CAB-CL1', stock: 3, minStock: 6, cost: 4500, price: 9500 }),
      accessory({ id: 'case', name: 'Funda MagSafe transparente iPhone 15', category: 'Fundas', sku: 'FUN-MT15', stock: 2, minStock: 4, cost: 7500, price: 16500 }),
      accessory({ id: 'out', name: 'Templado privacidad iPhone 15 Pro', category: 'Templados', sku: 'TEM-15P', stock: 0, minStock: 2, cost: 1500, price: 6000 }),
    ];
    ctx.operationOptions = {
      sales: {
        products: [{
          id: 'eq-1',
          model: 'iPhone 13',
          capacity: '128GB',
          color: 'Medianoche',
          imei: '350000000000010',
          price: 650000,
          pendingSaleRegistration: false,
        }],
        clients: [],
      },
    };
    ctx.loadOperationOptions.mockReset();
    ctx.loadOperationOptions.mockResolvedValue(undefined);
    ctx.createOperation.mockReset();
    ctx.createOperation.mockResolvedValue({ summary: 'Venta registrada' });
  });

  it('lists accessories apart from equipment and filters low stock', async () => {
    const user = userEvent.setup();
    renderInventory();

    expect(screen.getByRole('button', { name: 'Registrar equipo' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar modelo, color o IMEI')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accesorios 4' }));

    expect(screen.getByRole('button', { name: 'Nuevo accesorio' })).toBeInTheDocument();
    expect(screen.getByText('3 accesorios necesitan reposición')).toBeInTheDocument();
    expect(screen.getByText('Cable USB-C a Lightning 1 m · Funda MagSafe transparente iPhone 15 · Templado privacidad iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getByText('Cargador 20W USB-C')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Solo stock bajo' }));

    expect(screen.queryByText('Cargador 20W USB-C')).not.toBeInTheDocument();
    expect(screen.getByText('Cable USB-C a Lightning 1 m')).toBeInTheDocument();
    expect(screen.getByText('Templado privacidad iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getAllByText('Sin stock').length).toBeGreaterThan(0);
  });

  it('adds accessories to a sale without exceeding stock and sends them with the total', async () => {
    const user = userEvent.setup();
    ctx.accessories = [
      accessory({ id: 'case', name: 'Funda de silicona iPhone 13', category: 'Fundas', compatibleWith: 'iPhone 13', sku: 'FUN-S13', stock: 2, minStock: 4, cost: 5000, price: 12000 }),
    ];
    render(
      <DeskProvider value={{ tab: 'sales', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
        <DeskOverlays overlay={{ type: 'new-sale' }} />
      </DeskProvider>,
    );

    await user.click(screen.getByRole('button', { name: /iPhone 13 · 128GB/ }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar accesorio' }), 'fun');
    expect(screen.getByText(/quedan 2/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar Funda de silicona iPhone 13' }));
    await user.click(screen.getByRole('button', { name: 'Sumar Funda de silicona iPhone 13' }));
    expect(screen.getByRole('button', { name: 'Sumar Funda de silicona iPhone 13' })).toBeDisabled();
    expect(screen.getByText('Al confirmar se descuentan 2 unidades del stock de accesorios.')).toBeInTheDocument();
    expect(screen.getByText('$ 674.000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    await waitFor(() => expect(ctx.createOperation).toHaveBeenCalledWith('sales', expect.objectContaining({
      amount: 674000,
      productId: 'eq-1',
      accessories: [{ accessoryId: 'case', quantity: 2 }],
    })));
  });
});
