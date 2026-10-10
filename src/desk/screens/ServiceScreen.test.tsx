import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function dragData() {
  const data = new Map<string, string>();
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (key: string, value: string) => { data.set(key, value); },
    getData: (key: string) => data.get(key) ?? '',
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
      order('95', 'EN_REPARACION', { device: 'iPhone 14', clientName: 'Ejemplo C', fault: 'Cámara trasera borrosa', estimate: 120000 }),
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
    expect(screen.getByTestId('repair-column-EN_REPARACION')).toHaveTextContent('#OT-0095');
    expect(screen.queryByTestId('repair-column-EN_DIAGNOSTICO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repair-column-ESPERANDO_REPUESTO')).not.toBeInTheDocument();
    expect(screen.queryByText('En diagnóstico')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando repuesto')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando respuesta')).not.toBeInTheDocument();
    expect(screen.getByTestId('repair-card-101')).toHaveAttribute('draggable', 'true');
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

  it('keeps retired orders inside Recibido and out of the board', () => {
    state.repairOrders = [
      order('101', 'EN_DIAGNOSTICO'),
      order('95', 'ESPERANDO_REPUESTO'),
      order('96', 'ESPERANDO_RESPUESTA', { clientName: 'Ejemplo B' }),
    ];
    desk(<ServiceScreen />);
    expect(screen.queryByTestId('repair-column-EN_DIAGNOSTICO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repair-column-ESPERANDO_REPUESTO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repair-column-ESPERANDO_RESPUESTA')).not.toBeInTheDocument();
    expect(screen.queryByText('En diagnóstico')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando repuesto')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando respuesta')).not.toBeInTheDocument();
    const received = screen.getByTestId('repair-column-RECIBIDO');
    expect(received).toHaveTextContent('#OT-0101');
    expect(received).toHaveTextContent('#OT-0095');
    expect(received).toHaveTextContent('#OT-0096');
  });

  it('drags an order between columns with the same notice and WhatsApp as the status button', async () => {
    const user = userEvent.setup();
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    changeRepairStatus.mockImplementation(async (id: string, status: string) => {
      const next = order(id, status, {
        whatsappUrl: status === 'LISTO_PARA_RETIRAR' ? 'https://wa.me/5492614000000?text=listo' : null,
        events: [
          { id: 'a', status: 'RECIBIDO', createdAt: '03/10/2026' },
          { id: 'b', status, createdAt: '08/10/2026' },
        ],
      });
      state.repairOrders = state.repairOrders.map((item) => item.id === id ? next : item);
      return next;
    });
    desk(<ServiceScreen />);
    const card = screen.getByTestId('repair-card-101');
    card.focus();
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledWith({ type: 'ot', id: '101' });
    expect(changeRepairStatus).not.toHaveBeenCalled();

    const data = dragData();
    fireEvent.dragStart(card, { dataTransfer: data });
    fireEvent.dragOver(screen.getByTestId('repair-column-RECIBIDO'), { dataTransfer: data });
    fireEvent.drop(screen.getByTestId('repair-column-RECIBIDO'), { dataTransfer: data });
    expect(changeRepairStatus).not.toHaveBeenCalled();

    fireEvent.dragStart(card, { dataTransfer: data });
    fireEvent.dragOver(screen.getByTestId('repair-column-EN_REPARACION'), { dataTransfer: data });
    await waitFor(() => expect(screen.getByTestId('repair-column-EN_REPARACION')).toHaveClass('over'));
    fireEvent.drop(screen.getByTestId('repair-column-EN_REPARACION'), { dataTransfer: data });
    fireEvent.click(card);
    await waitFor(() => expect(changeRepairStatus).toHaveBeenCalledWith('101', 'EN_REPARACION'));
    expect(toast).toHaveBeenCalledWith('Pasó a En reparación');
    expect(opened).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);

    const ready = dragData();
    const readyCard = screen.getByTestId('repair-card-101');
    fireEvent.dragStart(readyCard, { dataTransfer: ready });
    fireEvent.drop(screen.getByTestId('repair-column-LISTO_PARA_RETIRAR'), { dataTransfer: ready });
    await waitFor(() => expect(changeRepairStatus).toHaveBeenCalledWith('101', 'LISTO_PARA_RETIRAR'));
    expect(opened).toHaveBeenCalledWith('https://wa.me/5492614000000?text=listo', '_blank', 'noopener,noreferrer');
    expect(toast).toHaveBeenCalledWith('Pasó a Listo para retirar');
    opened.mockRestore();
  });

  it('keeps the order in place and shows the error when a drop fails', async () => {
    changeRepairStatus.mockRejectedValue(new Error('No se pudo cambiar el estado'));
    desk(<ServiceScreen />);
    const data = dragData();
    fireEvent.dragStart(screen.getByTestId('repair-card-101'), { dataTransfer: data });
    fireEvent.drop(screen.getByTestId('repair-column-EN_REPARACION'), { dataTransfer: data });
    await waitFor(() => expect(toast).toHaveBeenCalledWith('No se pudo cambiar el estado'));
    expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('Pasó a'));
    expect(screen.getByTestId('repair-column-RECIBIDO')).toHaveTextContent('#OT-0101');
  });

  it('keeps the previous status names in the history after they leave the board', () => {
    state.repairOrders = [order('95', 'RECIBIDO', {
      events: [
        { id: 'a', status: 'RECIBIDO', createdAt: '01/10/2026' },
        { id: 'b', status: 'EN_DIAGNOSTICO', createdAt: '02/10/2026' },
        { id: 'c', status: 'ESPERANDO_REPUESTO', createdAt: '03/10/2026' },
        { id: 'd', status: 'ESPERANDO_RESPUESTA', createdAt: '04/10/2026' },
        { id: 'e', status: 'RECIBIDO', createdAt: '05/10/2026' },
      ],
    })];
    desk(<RepairOrderDetail id="95" busy={false} />);
    expect(screen.getByText('En diagnóstico')).toBeInTheDocument();
    expect(screen.getByText('Esperando repuesto')).toBeInTheDocument();
    expect(screen.getByText('Esperando respuesta')).toBeInTheDocument();
    expect(screen.getByText('Sigue: En reparación')).toBeInTheDocument();
  });

  it('creates an order that starts as Recibido', async () => {
    const user = userEvent.setup();
    addRepairOrder.mockResolvedValue(order('110', 'RECIBIDO'));
    desk(<RepairOrderForm busy={false} error={null} />);
    await user.type(screen.getByRole('combobox'), 'Cliente nuevo');
    await user.type(screen.getByPlaceholderText('iPhone 13'), 'iPhone 13');
    await user.click(screen.getByRole('button', { name: 'Pantalla' }));
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    await waitFor(() => expect(addRepairOrder).toHaveBeenCalledWith(expect.objectContaining({
      clientName: 'Cliente nuevo',
      clientId: null,
      device: 'iPhone 13',
      faultTags: ['Pantalla'],
      status: 'RECIBIDO',
    })));
    expect(addRepairOrder.mock.calls[0]?.[0]).not.toHaveProperty('notifyWhatsapp');
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
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
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

describe('servicio técnico en el celular', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
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
    state.repairOrders = [
      order('101', 'RECIBIDO', { estimatedDelivery: '01/01/2020' }),
      order('95', 'EN_REPARACION', { device: 'iPhone 14', clientName: 'Ejemplo C', fault: 'Cámara trasera borrosa', estimate: null, estimatedDelivery: '01/01/2099' }),
    ];
    state.clients = [{ id: 'c1', name: 'Ejemplo A', phone: '2614000000', dni: '', email: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0 }];
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('groups open orders by status and keeps a single new-order button', async () => {
    const user = userEvent.setup();
    desk(<ServiceScreen />);
    expect(screen.queryByTestId('repair-column-RECIBIDO')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tablero' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lista' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Propuesta tentativa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tentativo/)).not.toBeInTheDocument();
    expect(screen.getByTestId('service-chips')).toHaveTextContent('Abiertas 2');
    expect(screen.getByTestId('service-chips')).toHaveTextContent('Recibido 1');
    expect(screen.getByTestId('repair-group-RECIBIDO')).toHaveTextContent('#OT-0101');
    expect(screen.getByTestId('repair-card-101')).toHaveTextContent('Atrasada · 01/01');
    expect(screen.getByTestId('repair-card-101')).toHaveTextContent('Pantalla rota');
    expect(screen.getByTestId('repair-card-101')).toHaveTextContent('$ 145.000');
    expect(screen.getByTestId('repair-group-EN_REPARACION')).toHaveTextContent('A cotizar');
    expect(screen.queryByTestId('repair-group-EN_DIAGNOSTICO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repair-group-ESPERANDO_REPUESTO')).not.toBeInTheDocument();
    expect(screen.queryByText('En diagnóstico')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando respuesta')).not.toBeInTheDocument();
    expect(screen.getByTestId('repair-card-101')).not.toHaveAttribute('draggable');
    expect(screen.getByTestId('repair-card-95')).toHaveTextContent('Entrega 01/01');
    expect(screen.getAllByRole('button', { name: 'Nueva orden' })).toHaveLength(1);
    expect(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Nueva orden' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recibido 1' }));
    expect(screen.getByTestId('repair-card-101')).toBeInTheDocument();
    expect(screen.queryByTestId('repair-card-95')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abiertas 2' }));
    await user.click(screen.getByTestId('repair-card-95'));
    expect(open).toHaveBeenCalledWith({ type: 'ot', id: '95' });
    await user.click(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Nueva orden' }));
    expect(open).toHaveBeenCalledWith({ type: 'new-ot' });
  });

  it('folds retired statuses into Recibido on the phone list', () => {
    state.repairOrders = [
      order('101', 'EN_DIAGNOSTICO'),
      order('95', 'ESPERANDO_RESPUESTA', { device: 'iPhone 14' }),
    ];
    desk(<ServiceScreen />);
    const chips = screen.getByTestId('service-chips');
    expect(chips).toHaveTextContent('Recibido 2');
    expect(chips).not.toHaveTextContent('En diagnóstico');
    expect(chips).not.toHaveTextContent('Esperando');
    expect(screen.getByTestId('repair-group-RECIBIDO')).toHaveTextContent('#OT-0101');
    expect(screen.getByTestId('repair-group-RECIBIDO')).toHaveTextContent('#OT-0095');
    expect(screen.queryByTestId('repair-group-EN_DIAGNOSTICO')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repair-group-ESPERANDO_RESPUESTA')).not.toBeInTheDocument();
    expect(screen.getByTestId('repair-card-95')).not.toHaveAttribute('draggable');
  });

  it('shows the phone detail with history, the next step and the sensitive actions', async () => {
    const user = userEvent.setup();
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    changeRepairStatus.mockImplementation(async (_id: string, status: string) => {
      const next = order('95', status, {
        device: 'iPhone 14',
        clientName: 'Ejemplo C',
        fault: 'Cámara trasera borrosa',
        estimate: 120000,
        estimatedDelivery: '01/01/2020',
        events: [
          { id: 'a', status: 'ESPERANDO_REPUESTO', createdAt: '01/10/2026' },
          { id: 'b', status, createdAt: '08/10/2026' },
        ],
        whatsappUrl: status === 'LISTO_PARA_RETIRAR' ? 'https://wa.me/5492614000000?text=listo' : null,
      });
      state.repairOrders = [next];
      return next;
    });
    state.repairOrders = [order('95', 'EN_REPARACION', {
      device: 'iPhone 14',
      clientName: 'Ejemplo C',
      fault: 'Cámara trasera borrosa',
      estimate: 120000,
      estimatedDelivery: '01/01/2020',
      events: [{ id: 'a', status: 'EN_REPARACION', createdAt: '02/10/2026' }],
    })];
    const view = desk(<RepairOrderDetail id="95" busy={false} />);
    expect(screen.getByRole('dialog', { name: '#OT-0095' })).toBeInTheDocument();
    expect(screen.getByText('iPhone 14 · Ejemplo C')).toBeInTheDocument();
    expect(screen.getByTestId('repair-step')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('repair-step')).toHaveTextContent('sigue');
    expect(screen.getByTestId('repair-step')).toHaveTextContent('Listo para retirar');
    expect(screen.getByText('Cámara trasera borrosa')).toBeInTheDocument();
    expect(screen.getByText('01/01 · atrasada')).toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('En reparación').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Tentativo/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pasar a Listo para retirar' }));
    expect(changeRepairStatus).toHaveBeenCalledWith('95', 'LISTO_PARA_RETIRAR');
    expect(opened).toHaveBeenCalledWith('https://wa.me/5492614000000?text=listo', '_blank', 'noopener,noreferrer');
    view.rerender(
      <DeskProvider value={{ tab: 'service', go: vi.fn(), open, openRecord: vi.fn(), close, toast, isStaff: false, canManageSensitive: true }}>
        <RepairOrderDetail id="95" busy={false} />
      </DeskProvider>,
    );
    expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(screen.getAllByRole('link', { name: 'Abrir WhatsApp' })).toHaveLength(1);
    opened.mockRestore();
  });

  it('says the order starts as Recibido and keeps the status choices', () => {
    desk(<RepairOrderForm busy={false} error={null} />);
    expect(screen.getByText('Arranca en «Recibido».')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recibido' })).toHaveClass('on');
    expect(screen.queryByRole('button', { name: 'En diagnóstico' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esperando repuesto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esperando respuesta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Avisarle al cliente por WhatsApp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tentativo/)).not.toBeInTheDocument();
  });

  it('keeps the budget editor and the delete confirmation on the phone sheet', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockImplementation(async () => {
      const next = order('95', 'ESPERANDO_REPUESTO', { estimate: 150000, deposit: 20000 });
      state.repairOrders = [next];
      return next;
    });
    desk(<RepairOrderDetail id="95" busy={false} />);
    await user.click(screen.getByTestId('repair-edit-budget'));
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '150000');
    await user.click(screen.getByTestId('repair-save-budget'));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', { estimate: 150000, deposit: 0, currency: null });
    expect(screen.getByRole('button', { name: 'Eliminar orden' })).toBeEnabled();
  });
});
