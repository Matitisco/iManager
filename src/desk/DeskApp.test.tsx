import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OperationNotification } from '../services/operations-api';
import { DeskApp } from './DeskApp';

const context = vi.hoisted(() => ({
  appSession: {
    user: { displayName: 'Ana', email: 'ana@test.com' },
    store: { id: 's', name: 'Casa' },
    membership: { role: 'OWNER' as const, sections: null as string[] | null },
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
  });
});
