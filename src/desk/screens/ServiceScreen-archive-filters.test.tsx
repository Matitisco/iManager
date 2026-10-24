import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepairOrder } from '../../types';
import { DeskProvider } from '../ui';
import { ServiceScreen } from './ServiceScreen';

const state = vi.hoisted(() => ({ active: [] as RepairOrder[], archived: [] as RepairOrder[] }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ repairOrders: state.active }) }));
vi.mock('../use-archived-rows', () => ({ useArchivedRows: () => ({ rows: state.archived, loading: false }) }));

function order(id: string, status: string, archived = true): RepairOrder {
  return {
    id, code: id, orderNumber: Number(id), status, device: `QA atencion equipo ${id}`,
    clientId: null, clientName: null, clientPhone: null, imei: '', fault: 'Pantalla', faultTags: [],
    estimate: 1000, deposit: 0, technician: '', estimatedDelivery: null, receivedAt: '24/10/2026',
    notifyWhatsapp: false, whatsappUrl: null, events: [],
    ...(archived ? { archivedAt: '2026-10-24T12:00:00Z' } : {}),
  };
}

const originalMatchMedia = window.matchMedia;
afterEach(() => { cleanup(); window.matchMedia = originalMatchMedia; });

describe.each(['board', 'list', 'phone'] as const)('archived repair filters: %s', view => {
  it('composes archived status, legacy status normalization, search and open orders', async () => {
    window.matchMedia = vi.fn(query => ({
      media: query, matches: view === 'phone' && query.includes('max-width'), onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
      removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    state.active = [order('1', 'RECIBIDO', false)];
    state.archived = [order('2', 'RECIBIDO'), order('3', 'EN_REPARACION'), order('4', 'ENTREGADO'), order('5', 'EN_DIAGNOSTICO')];
    const user = userEvent.setup();
    render(<DeskProvider value={{ tab: 'service', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <ServiceScreen />
    </DeskProvider>);
    if (view === 'list') await user.click(screen.getByRole('button', { name: 'Lista' }));
    await user.click(screen.getByRole('button', { name: 'Recibido 1' }));
    expect(screen.getByText('QA atencion equipo 1')).toBeInTheDocument();
    expect(screen.queryByText('QA atencion equipo 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(screen.queryByText('QA atencion equipo 1')).not.toBeInTheDocument();
    expect(screen.getByText('QA atencion equipo 2')).toBeInTheDocument();
    expect(screen.getByText('QA atencion equipo 5')).toBeInTheDocument();
    expect(screen.queryByText('QA atencion equipo 3')).not.toBeInTheDocument();
    expect(screen.queryByText('QA atencion equipo 4')).not.toBeInTheDocument();
    if (view === 'phone') {
      expect(screen.getByTestId('repair-group-RECIBIDO')).toBeInTheDocument();
      expect(screen.queryByTestId('repair-group-EN_REPARACION')).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'En reparación 1' }));
    expect(screen.getByText('QA atencion equipo 3')).toBeInTheDocument();
    expect(screen.queryByText('QA atencion equipo 2')).not.toBeInTheDocument();
    if (view === 'phone') await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.type(screen.getByPlaceholderText('Buscar orden o cliente'), 'equipo 2');
    expect(screen.queryByText('QA atencion equipo 3')).not.toBeInTheDocument();
    expect(screen.queryByText('QA atencion equipo 2')).not.toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText('Buscar orden o cliente'));

    await user.click(screen.getByRole('button', { name: 'Abiertas 3' }));
    expect(screen.getByText('QA atencion equipo 2')).toBeInTheDocument();
    expect(screen.getByText('QA atencion equipo 3')).toBeInTheDocument();
    expect(screen.queryByText('QA atencion equipo 4')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('QA atencion equipo 4')).toBeInTheDocument();
  });
});
