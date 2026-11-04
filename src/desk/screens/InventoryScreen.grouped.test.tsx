import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';

const context = vi.hoisted(() => ({
  user: { uid: 'test-owner', getIdToken: vi.fn(async () => 'test-token') },
  inventory: [] as Product[],
  suppliers: [
    { id: 'supplier-a', name: 'Proveedor Centro' },
    { id: 'supplier-b', name: 'Proveedor Norte' },
  ],
  appSession: {
    store: { id: 'store-a', name: 'Tienda ficticia', currency: 'USD' },
    membership: { role: 'OWNER', sections: ['inventory'] },
  },
  sectionChanges: {},
  viewSection: vi.fn(),
  operationNotifications: [],
  markNotificationRead: vi.fn(),
  updateProduct: vi.fn(),
}));
const open = vi.fn();
vi.mock('../../services/inventory-api', () => ({
  fetchArchivedInventory: vi.fn(async () =>
    context.inventory.filter((item) => item.archivedAt),
  ),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
const item = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  imei: `99000000000000${id}`,
  model: 'iPhone 15',
  capacity: '128 GB',
  color: 'Negro',
  condition: 'USADO',
  grade: 'A',
  batteryHealth: '91%',
  cost: 123.45,
  price: 200,
  currency: 'USD',
  status: 'DISPONIBLE',
  ...overrides,
});
function renderScreen() {
  return render(
    <DeskProvider
      value={{
        tab: 'inventory',
        go: vi.fn(),
        open,
        openRecord: vi.fn(),
        close: vi.fn(),
        toast: vi.fn(),
        isStaff: false,
      }}
    >
      <InventoryScreen />
    </DeskProvider>,
  );
}

describe.each([false, true])('Inventario por línea (móvil=%s)', (phone) => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: phone && query.includes('760'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    context.appSession = {
      store: { id: 'store-a', name: 'Tienda ficticia', currency: 'USD' },
      membership: { role: 'OWNER', sections: ['inventory'] },
    };
    context.inventory = Array.from({ length: 5 }, (_, index) =>
      item(String(index + 1), {
        status: index === 4 ? 'RESERVADO' : 'DISPONIBLE',
        color: index === 4 ? 'Azul' : 'Negro',
      }),
    );
  });

  it('excluye accesorios antes de agrupar y de contar equipos', () => {
    context.inventory.push(item('accessory', { kind: 'ACCESSORY', model: 'Funda ficticia', cantidad: 50, imei: '' }));
    renderScreen();
    expect(screen.queryByText('Funda ficticia')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('5 de 5');
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent('1 modelo · 5 equipos');
    expect(screen.queryByText('Funda ficticia')).not.toBeInTheDocument();
  });

  it('conserva la vista inicial, muestra tres unidades y permite ver todas y abrir detalle', () => {
    renderScreen();
    expect(
      screen.queryByRole('table', { name: 'Equipos por línea' }),
    ).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Por línea' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
      '1 modelo · 5 equipos',
    );
    expect(screen.getByText('Negro, Azul')).toBeInTheDocument();
    const model = screen.getByRole('button', { name: /iPhone 15 · 128 GB/ });
    fireEvent.click(model);
    const units = screen.getByRole('region', {
      name: 'Unidades de iPhone 15 · 128 GB',
    });
    expect(within(units).getAllByRole('listitem')).toHaveLength(3);
    expect(within(units).getAllByText('Usado A')).toHaveLength(3);
    fireEvent.click(
      within(units).getByRole('button', { name: 'Ver las 5 unidades' }),
    );
    expect(within(units).getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(
      within(units).getByRole('button', {
        name: 'Abrir equipo 990000000000005',
      }),
    );
    expect(open).toHaveBeenCalledWith({ type: 'eq', id: '5' });
    fireEvent.click(
      within(units).getByRole('button', { name: 'Ver menos unidades' }),
    );
    expect(within(units).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(model);
    expect(
      screen.queryByRole('region', { name: 'Unidades de iPhone 15 · 128 GB' }),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(
      screen.queryByTestId('inventory-group-total'),
    ).not.toBeInTheDocument();
  });

  it('filtra antes de agrupar y conserva archivados fuera de Todos', async () => {
    context.inventory.push(
      item('6', {
        cantidad: 3,
        imei: '',
        model: 'iPhone 14',
        supplierId: 'supplier-b',
      }),
      item('7', { archivedAt: '2026-11-01' }),
    );
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
      '2 modelos · 8 equipos',
    );
    if (phone) fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(
      screen.getByPlaceholderText(
        phone ? 'Buscar por IMEI, modelo o color' : 'Buscar modelo o color',
      ),
      { target: { value: '15' } },
    );
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
      '1 modelo · 5 equipos',
    );
    if (phone) fireEvent.click(screen.getByRole('button', { name: 'Estado' }));
    fireEvent.click(
      screen.getByRole(phone ? 'menuitemcheckbox' : 'button', {
        name: 'Disponible',
      }),
    );
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
      '1 modelo · 4 equipos',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    await waitFor(() =>
      expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
        '1 modelo · 1 equipo',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /iPhone 15 · 128 GB/ }));
    expect(screen.getAllByText('Archivado').length).toBeGreaterThan(0);
  });

  it('combina proveedor con los filtros activos en la vista agrupada', () => {
    context.inventory = [
      item('1', { supplierId: 'supplier-a', cantidad: 4, imei: '' }),
      item('2', { supplierId: 'supplier-b' }),
    ];
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Proveedor' }));
    fireEvent.click(screen.getByRole('option', { name: 'Proveedor Centro' }));
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
      '1 modelo · 4 equipos',
    );
    fireEvent.click(screen.getByRole('button', { name: /iPhone 15 · 128 GB/ }));
    expect(screen.getByRole('region')).toHaveTextContent('Sin IMEI · 4 u.');
  });

  it('agrupa todos los registros antes de paginar y conserva rangos y precios pendientes', () => {
    context.inventory = Array.from({ length: 12 }, (_, index) =>
      item(String(index + 1), {
        price: index === 0 ? 300 : index === 1 ? null : 200,
      }),
    );
    context.inventory.push(item('13', { model: 'iPhone 13', price: null }));
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    expect(screen.getByTestId('inventory-group-total')).toHaveTextContent(
      '2 modelos · 13 equipos',
    );
    const table = screen.getByRole('table', { name: 'Equipos por línea' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('iPhone 13');
    expect(within(table).getByText('A definir')).toBeInTheDocument();
    expect(within(table).getByText(/\$ 200.*–.*\$ 300/)).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Paginación' }),
    ).not.toBeInTheDocument();
  });

  it('pagina por modelos y vuelve a la primera página cuando cambia el filtro', () => {
    context.inventory = Array.from({ length: 9 }, (_, index) =>
      item(String(index + 1), { model: `iPhone ${18 - index}` }),
    );
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    expect(
      screen.getByRole('button', { name: /iPhone 10 ·/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /iPhone 18 ·/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(
      screen.getByRole('button', { name: /iPhone 18 ·/ }),
    ).toBeInTheDocument();
    if (phone) fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(
      screen.getByPlaceholderText(
        phone ? 'Buscar por IMEI, modelo o color' : 'Buscar modelo o color',
      ),
      { target: { value: '10' } },
    );
    expect(
      screen.getByRole('button', { name: /iPhone 10 ·/ }),
    ).toBeInTheDocument();
  });

  it('respeta canSeeFinancials y conserva el permiso temporal de STAFF (#691)', () => {
    context.appSession.membership.role = 'SELLER';
    const view = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    expect(screen.queryByText('Costo prom.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /iPhone 15 · 128 GB/ }));
    expect(screen.queryByText(/123,45/)).not.toBeInTheDocument();
    context.appSession.membership.role = 'STAFF';
    view.rerender(
      <DeskProvider
        value={{
          tab: 'inventory',
          go: vi.fn(),
          open,
          openRecord: vi.fn(),
          close: vi.fn(),
          toast: vi.fn(),
          isStaff: true,
        }}
      >
        <InventoryScreen />
      </DeskProvider>,
    );
    expect(screen.getByText('Costo prom.')).toBeInTheDocument();
  });

  it('recuerda preferencia por tienda y mantiene separadas las elecciones', () => {
    const view = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Por línea' }));
    expect(localStorage.getItem('inventory-line-view:store-a')).toBe('line');
    view.unmount();
    const second = renderScreen();
    expect(screen.getByRole('button', { name: 'Por línea' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    context.appSession.store.id = 'store-b';
    second.rerender(
      <DeskProvider
        value={{
          tab: 'inventory',
          go: vi.fn(),
          open,
          openRecord: vi.fn(),
          close: vi.fn(),
          toast: vi.fn(),
          isStaff: false,
        }}
      >
        <InventoryScreen />
      </DeskProvider>,
    );
    expect(screen.getByRole('button', { name: 'Por línea' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(localStorage.getItem('inventory-line-view:store-a')).toBe('line');
  });
});
