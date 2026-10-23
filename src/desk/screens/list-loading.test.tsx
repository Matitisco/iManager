import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { ClientsScreen } from './ClientsScreen';
import { DashboardContent } from './DashboardContent';
import { InventoryScreen } from './InventoryScreen';
import { SalesScreen } from './SalesScreen';
import { TradeInsScreen } from './TradeInsScreen';

const context = vi.hoisted(() => ({
  listsLoaded: false as boolean | undefined,
  sales: [] as never[],
  inventory: [] as never[],
  tradeIns: [] as never[],
  clients: [] as never[],
  operationDrafts: [] as never[],
  operationNotifications: [] as never[],
  backendStatus: 'ready',
  user: { uid: 'user-1' },
  appSession: {
    user: { displayName: 'Ana' },
    store: { id: 'store-1', name: 'Casa', currency: 'ARS' as const },
    membership: { role: 'OWNER', sections: null as string[] | null },
  },
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/reports-api', () => ({ fetchReportsOverview: vi.fn(async () => ({ summary: { revenue: 0, grossProfit: 0, unitsSold: 0, marginRate: 0 }, comparison: { available: false }, salesSeries: [], paymentMethods: [] })) }));
vi.mock('../../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));

function desk(child: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'dashboard', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      {child}
    </DeskProvider>,
  );
}

function phone() {
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
}

function desktop() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => { desktop(); });

describe('listas en carga', () => {
  it('no muestra estados vacíos del dashboard mientras los datos no llegaron', () => {
    context.listsLoaded = false;
    desk(<DashboardContent />);
    expect(screen.getByTestId('dashboard-sales-loading')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-trades')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Todavía no registraste ventas')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin canjes en curso')).not.toBeInTheDocument();
    expect(screen.queryByText('0 equipos')).not.toBeInTheDocument();
  });

  it('en el teléfono el dashboard también espera con tarjetas y no con el vacío', () => {
    phone();
    context.listsLoaded = false;
    desk(<DashboardContent />);
    expect(screen.getByTestId('dashboard-sales-loading')).toHaveClass('rows');
    expect(screen.getByTestId('dashboard-trades')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Todavía no registraste ventas')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin canjes en curso')).not.toBeInTheDocument();
  });

  it('muestra el vacío del dashboard solo cuando la respuesta llegó vacía', async () => {
    context.listsLoaded = true;
    desk(<DashboardContent />);
    expect(await screen.findByText('Todavía no registraste ventas')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-trades')).toHaveTextContent('Canjes en curso0');
    expect(screen.queryByTestId('dashboard-sales-loading')).not.toBeInTheDocument();
  });

  it.each([
    ['inventario', InventoryScreen, 'inventory-loading', 'Todavía no cargaste equipos'],
    ['ventas', SalesScreen, 'sales-loading', 'No encontré ventas.'],
    ['clientes', ClientsScreen, 'clients-loading', 'No encontré clientes.'],
    ['canjes', TradeInsScreen, 'tradeins-loading', 'No encontré canjes.'],
  ] as const)('en %s no muestra el vacío mientras carga y sí cuando la lista llegó vacía', (_name, Screen, testId, emptyCopy) => {
    context.listsLoaded = false;
    const loading = desk(<Screen />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByText(emptyCopy)).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no registraste ventas en este período. Cargá la primera cuando cierres una operación.')).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no registraste canjes. Cargá el primero cuando tomes un equipo como parte de pago.')).not.toBeInTheDocument();
    loading.unmount();

    context.listsLoaded = true;
    desk(<Screen />);
    expect(screen.getByText(emptyCopy)).toBeInTheDocument();
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  });

  it('en el teléfono inventario, ventas, clientes y canjes usan tarjetas mientras cargan', () => {
    phone();
    context.listsLoaded = false;
    for (const [Screen, testId, emptyCopy] of [
      [InventoryScreen, 'inventory-loading', 'Todavía no cargaste equipos'],
      [SalesScreen, 'sales-loading', 'No hay ventas'],
      [ClientsScreen, 'clients-loading', 'No hay clientes'],
      [TradeInsScreen, 'tradeins-loading', 'No hay canjes'],
    ] as const) {
      const view = desk(<Screen />);
      expect(screen.getByTestId(testId)).toHaveClass('cards');
      expect(screen.queryByText(emptyCopy)).not.toBeInTheDocument();
      view.unmount();
    }
  });
});
