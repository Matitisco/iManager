import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OperationNotification } from '../../services/operations-api';
import { DeskProvider } from '../ui';
import { NotificationsScreen } from './AccountScreens';

const context = vi.hoisted(() => ({
  operationNotifications: [] as OperationNotification[],
  notificationsLoading: false,
  notificationsError: null as string | null,
  refreshNotifications: vi.fn(async () => undefined),
  markNotificationRead: vi.fn(async () => undefined),
  markAllNotificationsRead: vi.fn(async () => undefined),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function note(partial: Partial<OperationNotification> & Pick<OperationNotification, 'id' | 'section' | 'title' | 'message'>): OperationNotification {
  return {
    storeId: 's',
    recordId: partial.id,
    kind: 'INTEGRATED_OPERATION',
    createdAt: '2026-10-08T12:00:00.000Z',
    readAt: null,
    ...partial,
  };
}

function renderScreen(back?: () => void) {
  return render(
    <DeskProvider value={{ tab: 'notifications', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, back }}>
      <NotificationsScreen />
    </DeskProvider>,
  );
}

describe('Notifications screen unread counts', () => {
  it('shows a counter per section plus the total, and filters by that section', async () => {
    const user = userEvent.setup();
    context.operationNotifications = [
      note({ id: 'inv', section: 'inventory', title: 'Equipo vendido', message: 'iPhone 13 vendido' }),
      note({ id: 'sale', section: 'sales', title: 'Venta registrada', message: 'iPhone 13 · Juan Pérez · $ 50.000', readAt: '2026-10-08T13:00:00.000Z' }),
      note({ id: 'client', section: 'clients', title: 'Saldo pendiente', message: 'Juan Pérez debe $ 50.000' }),
    ];
    renderScreen();

    expect(screen.getByText('Total: 2 sin leer')).toBeInTheDocument();
    expect(document.querySelector('[data-icon="vendido"]')).toHaveAttribute('data-active', 'true');
    expect(document.querySelector('[data-icon="venta-por-registrar"]')).toHaveAttribute('data-active', 'false');
    expect(document.querySelector('[data-icon="cliente"]')).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'Inventario 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ventas 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Canjes 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clientes 1' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Inventario 1' }));
    expect(screen.getByText('Equipo vendido')).toBeInTheDocument();
    expect(screen.queryByText('Saldo pendiente')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ventas 0' }));
    expect(screen.getByText('Venta registrada')).toBeInTheDocument();
    expect(screen.queryByText('Equipo vendido')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Canjes 0' }));
    expect(screen.getByText('No hay notificaciones de Canjes.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar notificaciones')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leer todas' })).toBeInTheDocument();
    expect(screen.queryByTestId('notifications-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-groups')).not.toBeInTheDocument();
  });
});

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(15, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

describe('Notifications on a phone', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    context.operationNotifications = [];
    context.notificationsLoading = false;
    context.notificationsError = null;
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

  it('shows the empty history, the back header and the read segments', () => {
    usePhone();
    context.operationNotifications = [];
    renderScreen(() => undefined);
    expect(screen.getByTestId('page-back')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument();
    expect(screen.getByText('Estás al día')).toBeInTheDocument();
    expect(screen.getByTestId('notifications-empty')).toHaveTextContent('No hay notificaciones');
    expect(screen.getByTestId('notifications-empty')).toHaveTextContent('Todavía no tenés notificaciones en tu historial.');
    expect(screen.getByPlaceholderText('Buscar notificaciones')).toBeInTheDocument();
    expect(within(screen.getByTestId('notifications-read-filter')).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('notifications-read-filter')).getByRole('button', { name: 'Sin leer' })).toBeInTheDocument();
    expect(screen.queryByText('Total:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leer todas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).not.toBeInTheDocument();
  });

  it('groups section notices, keeps Argentine amounts, and marks them read', async () => {
    usePhone();
    const user = userEvent.setup();
    context.operationNotifications = [
      note({ id: 'inv', section: 'inventory', title: 'Equipo vendido', message: 'iPhone 13 vendido', createdAt: daysAgo(0) }),
      note({ id: 'sale', section: 'sales', title: 'Venta registrada', message: 'iPhone 13 · Juan Pérez · $ 50.000', createdAt: daysAgo(2), readAt: daysAgo(1) }),
      note({ id: 'client', section: 'clients', title: 'Saldo pendiente', message: 'Juan Pérez debe $ 50.000', createdAt: daysAgo(10) }),
    ];
    renderScreen();

    expect(screen.getByText('2 sin leer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeInTheDocument();
    expect(within(screen.getByTestId('notifications-read-filter')).getByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('notification-group-hoy')).toHaveTextContent('Equipo vendido');
    expect(screen.getByTestId('notification-group-hoy')).toHaveTextContent('iPhone 13 vendido');
    expect(screen.getByTestId('notification-group-semana')).toHaveTextContent('Venta registrada');
    expect(screen.getByTestId('notification-group-semana')).toHaveTextContent('$ 50.000');
    expect(screen.getByTestId('notification-group-antes')).toHaveTextContent('Juan Pérez debe $ 50.000');
    expect(screen.getByTestId('notifications-sections').querySelector('button.on')).toHaveTextContent('Todas');
    expect(document.querySelector('[data-icon="vendido"]')).toHaveAttribute('data-active', 'true');
    expect(document.querySelector('[data-icon="venta-por-registrar"]')).toHaveAttribute('data-active', 'false');

    await user.click(within(screen.getByTestId('notifications-sections')).getByRole('button', { name: 'Inventario 1' }));
    expect(screen.getByText('Equipo vendido')).toBeInTheDocument();
    expect(screen.queryByText('Saldo pendiente')).not.toBeInTheDocument();
    expect(screen.queryByText('Venta registrada')).not.toBeInTheDocument();

    await user.click(within(screen.getByTestId('notifications-sections')).getByRole('button', { name: 'Todas' }));
    await user.click(within(screen.getByTestId('notifications-read-filter')).getByRole('button', { name: 'Sin leer' }));
    expect(screen.getByText('Equipo vendido')).toBeInTheDocument();
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Venta registrada')).not.toBeInTheDocument();

    await user.click(within(screen.getByTestId('notifications-read-filter')).getByRole('button', { name: 'Todas' }));
    await user.type(screen.getByPlaceholderText('Buscar notificaciones'), '50.000');
    expect(screen.getByText('Venta registrada')).toBeInTheDocument();
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Equipo vendido')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Buscar notificaciones'));
    await user.click(within(screen.getByTestId('notifications-sections')).getByRole('button', { name: 'Canjes 0' }));
    expect(screen.getByText('No hay notificaciones de Canjes.')).toBeInTheDocument();

    await user.click(within(screen.getByTestId('notifications-sections')).getByRole('button', { name: 'Todas' }));
    await user.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(context.markAllNotificationsRead).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Equipo vendido/ }));
    expect(context.markNotificationRead).toHaveBeenCalledWith('inv');
  });
});
