import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairOrder } from '../../types';
import { DeskProvider } from '../ui';
import { RepairOrderDetail, RepairOrderForm } from '../RepairForms';
import { ServiceScreen } from './ServiceScreen';

const open = vi.fn();
const close = vi.fn();
const toast = vi.fn();
const addRepairOrder = vi.fn();
const changeRepairStatus = vi.fn();

const state = vi.hoisted(() => ({
  repairOrders: [] as RepairOrder[],
  clients: [] as { id: string; name: string; phone: string; dni: string; email: string; lastPurchaseDate: string; totalSpent: number; pendingBalance: number }[],
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    repairOrders: state.repairOrders,
    repairOrdersError: null,
    clients: state.clients,
    addRepairOrder,
    changeRepairStatus,
  }),
}));

function order(id: string, status: string, overrides: Partial<RepairOrder> = {}): RepairOrder {
  return {
    id,
    orderNumber: Number(id),
    code: `OT-${id.padStart(4, '0')}`,
    clientId: 'c1',
    clientName: 'Ejemplo A',
    clientPhone: '2614000000',
    device: 'iPhone 12',
    imei: '350000000000001',
    fault: 'Pantalla rota',
    faultTags: ['Pantalla'],
    estimate: 145000,
    deposit: 0,
    technician: 'Técnico Ejemplo',
    status,
    estimatedDelivery: '08/10/2026',
    notifyWhatsapp: true,
    receivedAt: '03/10/2026',
    whatsappUrl: null,
    events: [{ id: `${id}-e`, status, createdAt: '03/10/2026' }],
    ...overrides,
  };
}

function desk(children: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'service', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false }}>
      {children}
    </DeskProvider>,
  );
}

describe('servicio técnico', () => {
  beforeEach(() => {
    open.mockReset();
    close.mockReset();
    toast.mockReset();
    addRepairOrder.mockReset();
    changeRepairStatus.mockReset();
    state.repairOrders = [
      order('101', 'RECIBIDO'),
      order('95', 'ESPERANDO_REPUESTO', { device: 'iPhone 14', clientName: 'Ejemplo C', fault: 'Cámara trasera borrosa', estimate: 120000 }),
    ];
    state.clients = [{ id: 'c1', name: 'Ejemplo A', phone: '2614000000', dni: '', email: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0 }];
  });

  it('shows the board by status and the same orders as a list', async () => {
    const user = userEvent.setup();
    desk(<ServiceScreen />);
    expect(screen.getByRole('heading', { name: 'Servicio técnico' })).toBeInTheDocument();
    expect(screen.getByText(/Propuesta tentativa/)).toBeInTheDocument();
    expect(screen.getByText('2 órdenes abiertas · 0 listas para retirar')).toBeInTheDocument();
    expect(screen.getByTestId('repair-column-RECIBIDO')).toHaveTextContent('1');
    expect(screen.getByTestId('repair-column-ESPERANDO_REPUESTO')).toHaveTextContent('#OT-0095');
    expect(screen.getByTestId('repair-card-101')).toHaveTextContent('$ 145.000');
    await user.click(screen.getByTestId('repair-card-95'));
    expect(open).toHaveBeenCalledWith({ type: 'ot', id: '95' });

    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByTestId('repair-row-95')).toHaveTextContent('Ejemplo C');
    expect(screen.getByTestId('repair-row-95')).toHaveTextContent('Cámara trasera borrosa');
    await user.click(screen.getByTestId('repair-row-95'));
    expect(open).toHaveBeenCalledWith({ type: 'ot', id: '95' });

    await user.click(screen.getByRole('button', { name: 'Nueva orden' }));
    expect(open).toHaveBeenCalledWith({ type: 'new-ot' });
  });

  it('creates an order that starts as Recibido', async () => {
    const user = userEvent.setup();
    addRepairOrder.mockResolvedValue(order('110', 'RECIBIDO'));
    desk(<RepairOrderForm busy={false} error={null} />);
    await user.type(screen.getByRole('combobox'), 'Cliente nuevo');
    await user.type(screen.getByPlaceholderText('iPhone 13'), 'iPhone 13');
    await user.click(screen.getByRole('button', { name: 'Pantalla' }));
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    await waitFor(() => expect(addRepairOrder).toHaveBeenCalledWith(expect.objectContaining({
      clientName: 'Cliente nuevo',
      clientId: null,
      device: 'iPhone 13',
      faultTags: ['Pantalla'],
      status: 'RECIBIDO',
      notifyWhatsapp: true,
    })));
    await waitFor(() => expect(close).toHaveBeenCalled());
  });

  it('advances the status and keeps the history visible', async () => {
    const user = userEvent.setup();
    changeRepairStatus.mockImplementation(async (_id: string, status: string) => {
      const next = order('95', status, {
        events: [
          { id: 'a', status: 'RECIBIDO', createdAt: '01/10/2026' },
          { id: 'b', status, createdAt: '08/10/2026' },
        ],
        whatsappUrl: status === 'LISTO_PARA_RETIRAR' ? 'https://wa.me/5492614000000?text=listo' : null,
      });
      state.repairOrders = [next];
      return next;
    });
    state.repairOrders = [order('95', 'LISTO_PARA_RETIRAR', {
      events: [
        { id: 'a', status: 'RECIBIDO', createdAt: '01/10/2026' },
        { id: 'b', status: 'LISTO_PARA_RETIRAR', createdAt: '08/10/2026' },
      ],
      whatsappUrl: 'https://wa.me/5492614000000?text=listo',
    })];
    const view = desk(<RepairOrderDetail id="95" busy={false} />);
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me'));
    await user.click(screen.getByRole('button', { name: 'Pasar a Entregado' }));
    expect(changeRepairStatus).toHaveBeenCalledWith('95', 'ENTREGADO');
    view.rerender(
      <DeskProvider value={{ tab: 'service', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false }}>
        <RepairOrderDetail id="95" busy={false} />
      </DeskProvider>,
    );
    expect(screen.queryByRole('button', { name: /Pasar a/ })).not.toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
  });
});
