import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'notifications', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
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
  });
});
