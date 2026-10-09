import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OperationNotification } from '../services/operations-api';
import { DeskApp } from './DeskApp';

const context = vi.hoisted(() => ({
  appSession: {
    user: { displayName: 'Ana', email: 'ana@test.com' },
    store: { id: 's', name: 'Casa' },
    membership: { role: 'OWNER' as 'OWNER' | 'MANAGER' | 'STAFF', sections: null as string[] | null },
    onboardingRequired: false,
  },
  user: null,
  tradeIns: [{ id: 't1', status: 'EN REVISIÓN' }],
  inventory: [],
  sales: [],
  clients: [],
  operationNotifications: [] as OperationNotification[],
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));
vi.mock('../services/catalogs-api', () => ({ fetchCatalogs: vi.fn(async () => null), saveCatalog: vi.fn() }));

describe('sidebar unread counts', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    context.appSession.membership.role = 'OWNER';
    window.location.hash = '#/dash';
  });

  function usePhone() {
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

  it('shows the unread total and a badge on each section that has unread notes', () => {
    window.location.hash = '#/dash';
    context.operationNotifications = [
      { id: '1', storeId: 's', section: 'inventory', title: 'Equipo vendido', message: 'iPhone 13 vendido', recordId: 'p', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
      { id: '2', storeId: 's', section: 'inventory', title: 'Equipo recibido', message: 'Entró un iPhone 11 por canje, en revisión', recordId: 'p2', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
      { id: '3', storeId: 's', section: 'sales', title: 'Venta registrada', message: 'iPhone 13 · Juan Pérez · $ 50.000', recordId: 's1', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
      { id: '4', storeId: 's', section: 'clients', title: 'Saldo pendiente', message: 'Juan Pérez debe $ 50.000', recordId: 'c', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: '2026-10-08T13:00:00.000Z' },
    ];
    render(<DeskApp />);
    expect(screen.getByLabelText('3 en total')).toHaveTextContent('3');
    expect(screen.getByLabelText('2 en Inventario')).toHaveTextContent('2');
    expect(screen.getByLabelText('1 en Ventas')).toHaveTextContent('1');
    expect(screen.queryByLabelText(/en Clientes/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/en Canjes/)).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-tradeins')).toHaveTextContent('1');
    expect(screen.getByTestId('sidebar-tab-service')).toHaveTextContent('Servicio técnico');
    expect(screen.queryByText('★')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-tab-bar')).not.toBeInTheDocument();
  });

  it('lists the overflow sections on Más without commissions or a tentative label', () => {
    usePhone();
    window.location.hash = '#/mas';
    context.operationNotifications = [
      { id: '1', storeId: 's', section: 'sales', title: 'Venta', message: 'Una venta', recordId: 's1', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
    ];
    render(<DeskApp />);
    expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();
    expect(screen.getByText('Todo lo que no entra en la barra')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-store-name')).toHaveTextContent('Casa');
    expect(screen.getByTestId('more-profile')).toHaveTextContent('Ana');
    expect(screen.getByTestId('more-profile')).toHaveTextContent('Propietario');
    expect(screen.getByTestId('sidebar-tab-tradeins')).toHaveTextContent('1 en curso');
    expect(screen.getByTestId('sidebar-tab-clients')).toHaveTextContent('Agenda y saldos');
    expect(screen.getByTestId('sidebar-tab-service')).toHaveTextContent('0 abiertas');
    expect(screen.getByTestId('sidebar-tab-notifications')).toHaveTextContent('1 sin leer');
    expect(screen.getByTestId('sidebar-tab-settings')).toHaveTextContent('Configuración');
    expect(screen.getByTestId('sidebar-tab-more')).toHaveClass('on');
    expect(screen.getByTestId('sidebar-tab-reports')).toBeInTheDocument();
    expect(screen.queryByText('Comisiones')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tentativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/propuesta/i)).not.toBeInTheDocument();
    expect(screen.queryByText('iManager')).not.toBeInTheDocument();
  });

  it('slides Canjes into the bar when an employee cannot open Reportes', () => {
    usePhone();
    window.location.hash = '#/dash';
    context.appSession.membership.role = 'STAFF';
    render(<DeskApp />);
    expect(screen.getByTestId('sidebar-tab-dashboard')).toHaveClass('on');
    expect(screen.getByTestId('sidebar-tab-inventory')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-sales')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-tradeins')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-tab-reports')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-tab-service')).not.toBeInTheDocument();
  });
});
