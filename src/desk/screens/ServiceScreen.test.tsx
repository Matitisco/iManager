import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairOrder } from '../../types';
import { ExchangeProvider, type StoreExchange } from '../exchange';
import { FX_WARNING } from '../money';
import { DeskProvider } from '../ui';
import { RepairOrderDetail, RepairOrderForm } from '../RepairForms';
import { ServiceScreen } from './ServiceScreen';

const open = vi.fn();
const close = vi.fn();
const toast = vi.fn();
const addRepairOrder = vi.fn();
const changeRepairStatus = vi.fn();
const updateRepairOrder = vi.fn();
const deleteRepairOrder = vi.fn();

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
    updateRepairOrder,
    deleteRepairOrder,
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

function desk(children: ReactNode, canManageSensitive = true) {
  return render(
    <DeskProvider value={{ tab: 'service', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false, canManageSensitive }}>
      {children}
    </DeskProvider>,
  );
}

const ARS: StoreExchange = { currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 };

function deskMoney(children: ReactNode, settings: StoreExchange, canManageSensitive = true) {
  return render(
    <ExchangeProvider settings={settings}>
      <DeskProvider value={{ tab: 'service', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false, canManageSensitive }}>
        {children}
      </DeskProvider>
    </ExchangeProvider>,
  );
}

describe('servicio técnico', () => {
  beforeEach(() => {
    open.mockReset();
    close.mockReset();
    toast.mockReset();
    addRepairOrder.mockReset();
    changeRepairStatus.mockReset();
    updateRepairOrder.mockReset();
    deleteRepairOrder.mockReset();
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
    expect(screen.queryByText(/Propuesta tentativa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/propuesta exploratoria/)).not.toBeInTheDocument();
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
      <DeskProvider value={{ tab: 'service', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false, canManageSensitive: true }}>
        <RepairOrderDetail id="95" busy={false} />
      </DeskProvider>,
    );
    expect(screen.queryByRole('button', { name: /Pasar a/ })).not.toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
  });

  it('lets a sensitive member edit the budget and delete the order after confirming', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockImplementation(async () => {
      const next = order('95', 'ESPERANDO_REPUESTO', { estimate: 150000, deposit: 20000 });
      state.repairOrders = [next];
      return next;
    });
    deleteRepairOrder.mockResolvedValue(undefined);
    desk(<RepairOrderDetail id="95" busy={false} />);
    await user.click(screen.getByRole('button', { name: 'Editar presupuesto' }));
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '150000');
    await user.clear(screen.getByLabelText('Seña'));
    await user.type(screen.getByLabelText('Seña'), '20000');
    await user.click(screen.getByTestId('repair-save-budget'));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', { estimate: 150000, deposit: 20000, currency: null });
    expect(screen.getByText('$ 150.000')).toBeInTheDocument();
    expect(screen.getByText('$ 20.000')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Eliminar orden' }));
    expect(screen.getByRole('dialog', { name: 'Eliminar orden' })).toHaveTextContent('no se puede deshacer');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(deleteRepairOrder).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Eliminar orden' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(deleteRepairOrder).toHaveBeenCalledWith('95');
    expect(close).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Orden eliminada');
  });

  it('keeps the budget form open and shows the Spanish error when saving fails', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockRejectedValue(new Error('No tenés permiso para esta acción'));
    desk(<RepairOrderDetail id="95" busy={false} />);
    await user.click(screen.getByRole('button', { name: 'Editar presupuesto' }));
    await user.click(screen.getByTestId('repair-save-budget'));
    expect(await screen.findByText('No tenés permiso para esta acción')).toBeInTheDocument();
    expect(screen.getByLabelText('Presupuesto')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });

  it('disables budget and delete for a member without sensitive actions', async () => {
    desk(<RepairOrderDetail id="95" busy={false} />, false);
    expect(screen.getByRole('button', { name: 'Editar presupuesto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar orden' })).toBeDisabled();
    expect(screen.getByText('Solo quien tiene Acciones sensibles puede cambiar el presupuesto, la seña o borrar la orden.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Presupuesto')).not.toBeInTheDocument();
  });

  it('shows the order currency in the store format and keeps it when the amount does not change', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockResolvedValue(order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' }));
    state.repairOrders = [order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' })];
    deskMoney(<RepairOrderDetail id="95" busy={false} />, ARS);
    expect(screen.getByText('$ 100.000')).toBeInTheDocument();
    expect(screen.getByText('$ 10.000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar presupuesto' }));
    expect(screen.getByLabelText('Presupuesto')).toHaveValue('100.000');
    expect(screen.getByLabelText('Seña')).toHaveValue('10.000');
    await user.click(screen.getByTestId('repair-save-budget'));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', { estimate: 100, deposit: 10, currency: 'USD' });
  });

  it('stamps the store currency when the displayed budget changes', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockResolvedValue(order('95', 'ESPERANDO_REPUESTO'));
    state.repairOrders = [order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' })];
    deskMoney(<RepairOrderDetail id="95" busy={false} />, ARS);
    await user.click(screen.getByRole('button', { name: 'Editar presupuesto' }));
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '200000');
    await user.click(screen.getByTestId('repair-save-budget'));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', { estimate: 200000, deposit: 10000, currency: 'ARS' });
  });

  it('keeps the saved currency and explains when there is no quote to convert a new amount', async () => {
    const user = userEvent.setup();
    state.repairOrders = [order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' })];
    deskMoney(<RepairOrderDetail id="95" busy={false} />, { ...ARS, manualBuy: null, manualSell: null });
    expect(screen.getByText('US$ 100')).toBeInTheDocument();
    expect(screen.getByText('US$ 10')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar presupuesto' }));
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '200');
    await user.click(screen.getByTestId('repair-save-budget'));
    expect(screen.getByText(FX_WARNING)).toBeInTheDocument();
    expect(updateRepairOrder).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
