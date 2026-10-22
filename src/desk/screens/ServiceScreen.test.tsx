import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepairOrder } from '../../types';
import { fetchHistory, type HistoryEvent } from '../../services/history-api';
import { ExchangeProvider, type StoreExchange } from '../exchange';
import { FX_WARNING } from '../money';
import { DeskProvider } from '../ui';
import { DeskOverlays } from '../DeskOverlays';
import { RepairOrderDetail, RepairOrderEditor, RepairOrderForm } from '../RepairForms';
import { DEPOSIT_OVER_ESTIMATE } from '../repairs';
import { ServiceScreen } from './ServiceScreen';

const open = vi.fn();
const close = vi.fn();
const toast = vi.fn();
const addRepairOrder = vi.fn();
const changeRepairStatus = vi.fn();
const updateRepairOrder = vi.fn();
const deleteRepairOrder = vi.fn();

const state = vi.hoisted(() => ({
  user: { uid: 'owner' },
  repairOrders: [] as RepairOrder[],
  clients: [] as { id: string; name: string; phone: string; dni: string; email: string; lastPurchaseDate: string; totalSpent: number; pendingBalance: number }[],
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    user: state.user,
    repairOrders: state.repairOrders,
    repairOrdersError: null,
    clients: state.clients,
    addRepairOrder,
    changeRepairStatus,
    updateRepairOrder,
    deleteRepairOrder,
  }),
}));
vi.mock('../../services/history-api', () => ({ fetchHistory: vi.fn() }));

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
    vi.mocked(fetchHistory).mockReset();
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
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers.indexOf('Equipo')).toBeLessThan(headers.indexOf('Cliente'));
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

  it('keeps the previous status names in the second history modal after they leave the board', async () => {
    state.repairOrders = [order('95', 'RECIBIDO', {
      events: [
        { id: 'a', status: 'RECIBIDO', createdAt: '01/10/2026' },
        { id: 'b', status: 'EN_DIAGNOSTICO', createdAt: '02/10/2026' },
        { id: 'c', status: 'ESPERANDO_REPUESTO', createdAt: '03/10/2026' },
        { id: 'd', status: 'ESPERANDO_RESPUESTA', createdAt: '04/10/2026' },
        { id: 'e', status: 'RECIBIDO', createdAt: '05/10/2026' },
      ],
    })];
    vi.mocked(fetchHistory).mockResolvedValue({ events: state.repairOrders[0].events.map(event => ({
      id: event.id, createdAt: '2026-10-01T12:00:00.000Z', action: 'repair.status',
      changes: [{ field: 'status', label: 'Estado', before: null, after: event.status }],
      actorName: 'Sin autor registrado',
    } as HistoryEvent)), nextCursor: null });
    desk(<RepairOrderDetail id="95" busy={false} />);
    expect(screen.queryByText('En diagnóstico')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando repuesto')).not.toBeInTheDocument();
    expect(screen.queryByText('Esperando respuesta')).not.toBeInTheDocument();
    expect(screen.getByText('Sigue: En reparación')).toBeInTheDocument();
    expect(fetchHistory).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    const history = screen.getByRole('dialog', { name: 'Historial' });
    expect(await within(history).findByText('Pasó a En diagnóstico')).toBeInTheDocument();
    expect(within(history).getByText('Pasó a Esperando repuesto')).toBeInTheDocument();
    expect(within(history).getByText('Pasó a Esperando respuesta')).toBeInTheDocument();
  });

  it('shows the device as the card title and the client only when the order has one', () => {
    state.repairOrders = [
      order('101', 'RECIBIDO', { device: 'Pixel suelto', clientName: '', clientId: null }),
      order('95', 'EN_REPARACION', { device: 'iPhone 14', clientName: 'Ejemplo C' }),
    ];
    desk(<ServiceScreen />);
    const loose = screen.getByTestId('repair-card-101');
    expect(within(loose).getByTestId('repair-device-101')).toHaveTextContent('Pixel suelto');
    expect(within(loose).queryByTestId('repair-client-101')).not.toBeInTheDocument();
    const linked = screen.getByTestId('repair-card-95');
    const device = within(linked).getByTestId('repair-device-95');
    const client = within(linked).getByTestId('repair-client-95');
    expect(device).toHaveTextContent('iPhone 14');
    expect(client).toHaveTextContent('Ejemplo C');
    expect(device.compareDocumentPosition(client) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps a long fault to three lines on the board and the list, and the full text in the preview', async () => {
    const user = userEvent.setup();
    const fault = `${'La pantalla queda negra y el táctil no responde. '.repeat(6)}${'Conector'.repeat(12)}`;
    state.repairOrders = [order('101', 'RECIBIDO', { fault, faultTags: [] })];
    desk(<ServiceScreen />);
    const cardFault = within(screen.getByTestId('repair-card-101')).getByTestId('repair-fault-101');
    expect(cardFault).toHaveClass('svc-fault');
    expect(cardFault).toHaveTextContent(fault);
    await user.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByTestId('repair-fault-101')).toHaveClass('svc-fault');
    expect(screen.getByTestId('repair-fault-101')).toHaveTextContent(fault);
    cleanup();
    desk(<RepairOrderDetail id="101" busy={false} />);
    const preview = screen.getByTestId('repair-fault');
    expect(preview).toHaveClass('svc-fault-full');
    expect(preview).not.toHaveClass('svc-fault');
    expect(preview).toHaveTextContent(fault);
  });

  it('puts the device above the optional client and creates an order without one', async () => {
    const user = userEvent.setup();
    addRepairOrder.mockResolvedValue(order('110', 'RECIBIDO', { clientName: '', clientId: null, device: 'iPhone 13' }));
    desk(<RepairOrderForm busy={false} error={null} />);
    const device = screen.getByLabelText('Equipo');
    const client = screen.getByRole('combobox', { name: 'Cliente (opcional)' });
    const imei = screen.getByLabelText('IMEI (opcional)');
    expect(device.compareDocumentPosition(client) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(client.compareDocumentPosition(imei) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    expect(screen.getAllByText('Completá este dato')).toHaveLength(1);
    expect(addRepairOrder).not.toHaveBeenCalled();
    await user.type(device, 'iPhone 13');
    await user.click(screen.getByRole('button', { name: 'Batería' }));
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    await waitFor(() => expect(addRepairOrder).toHaveBeenCalledWith(expect.objectContaining({
      device: 'iPhone 13',
      clientId: null,
      clientName: null,
      faultTags: ['Batería'],
    })));
    expect(close).toHaveBeenCalled();
  });

  it('edits the device as required and lets the client stay empty', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockImplementation(async (_id: string, input: { device?: string; clientName?: string | null; clientId?: string | null }) => {
      const next = order('95', 'EN_REPARACION', {
        device: input.device ?? 'iPhone 14',
        clientName: input.clientName ?? '',
        clientId: input.clientId ?? null,
      });
      state.repairOrders = [next];
      return next;
    });
    state.repairOrders = [order('95', 'EN_REPARACION', { device: 'iPhone 14', clientName: 'Ejemplo C' })];
    desk(<RepairOrderDetail id="95" busy={false} />);
    expect(screen.getByTestId('repair-client')).toHaveTextContent('Ejemplo C');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar orden' })).not.toBeInTheDocument();
    await user.click(screen.getByTestId('repair-open-edit'));
    expect(open).toHaveBeenCalledWith({ type: 'edit-ot', id: '95' });

    open.mockClear();
    desk(<RepairOrderEditor id="95" busy={false} />);
    const device = screen.getByLabelText('Equipo');
    const client = screen.getByRole('combobox', { name: 'Cliente (opcional)' });
    expect(device.compareDocumentPosition(client) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.clear(device);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Completá este dato')).toBeInTheDocument();
    expect(updateRepairOrder).not.toHaveBeenCalled();
    await user.type(device, 'Pixel 8');
    await user.clear(client);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.objectContaining({
      device: 'Pixel 8',
      clientId: null,
      clientName: null,
    }));
    expect(close).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Orden actualizada');
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

  it('blocks a deposit above the budget and allows one within it', async () => {
    const user = userEvent.setup();
    addRepairOrder.mockResolvedValue(order('110', 'RECIBIDO'));
    desk(<RepairOrderForm busy={false} error={null} />);
    expect(screen.queryByText('Arranca en «Recibido».')).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('iPhone 13'), 'iPhone 13');
    await user.click(screen.getByRole('button', { name: 'Pantalla' }));
    await user.type(screen.getByLabelText('Presupuesto estimado'), '85000');
    const deposit = screen.getByLabelText('Seña');
    await user.clear(deposit);
    await user.type(deposit, '100000');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    expect(screen.getByText(DEPOSIT_OVER_ESTIMATE)).toBeInTheDocument();
    expect(addRepairOrder).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Seña'));
    await user.type(screen.getByLabelText('Seña'), '85000');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    await waitFor(() => expect(addRepairOrder).toHaveBeenCalledWith(expect.objectContaining({
      estimate: 85000,
      deposit: 85000,
    })));
  });

  it('allows a deposit when the order has no budget', async () => {
    const user = userEvent.setup();
    addRepairOrder.mockResolvedValue(order('110', 'RECIBIDO', { estimate: null, deposit: 100000 }));
    desk(<RepairOrderForm busy={false} error={null} />);
    await user.type(screen.getByPlaceholderText('iPhone 13'), 'iPhone 13');
    await user.click(screen.getByRole('button', { name: 'Batería' }));
    await user.clear(screen.getByLabelText('Seña'));
    await user.type(screen.getByLabelText('Seña'), '100000');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    await waitFor(() => expect(addRepairOrder).toHaveBeenCalledWith(expect.objectContaining({
      estimate: null,
      deposit: 100000,
    })));
    expect(screen.queryByText(DEPOSIT_OVER_ESTIMATE)).not.toBeInTheDocument();
  });

  it('blocks an edited deposit that is higher than the budget', async () => {
    const user = userEvent.setup();
    state.repairOrders = [order('95', 'EN_REPARACION', { estimate: 85000, deposit: 0 })];
    desk(<RepairOrderEditor id="95" busy={false} />);
    await user.clear(screen.getByLabelText('Seña'));
    await user.type(screen.getByLabelText('Seña'), '100000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText(DEPOSIT_OVER_ESTIMATE)).toBeInTheDocument();
    expect(updateRepairOrder).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '100000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.objectContaining({ estimate: 100000, deposit: 100000 }));
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
    expect(screen.getByRole('button', { name: 'Historial' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Historial' })).toBeInTheDocument();
  });

  it('lets a sensitive member edit the budget and delete the order after confirming', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockImplementation(async () => {
      const next = order('95', 'ESPERANDO_REPUESTO', { estimate: 150000, deposit: 20000 });
      state.repairOrders = [next];
      return next;
    });
    deleteRepairOrder.mockResolvedValue(undefined);
    desk(<RepairOrderEditor id="95" busy={false} />);
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '150000');
    await user.clear(screen.getByLabelText('Seña'));
    await user.type(screen.getByLabelText('Seña'), '20000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.objectContaining({ estimate: 150000, deposit: 20000, currency: null }));
    expect(close).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Orden actualizada');

    await user.click(screen.getByRole('button', { name: 'Archivar orden' }));
    const confirm = screen.getByRole('dialog', { name: 'Archivar orden' });
    expect(confirm).toHaveTextContent('vuelve como saldo a favor del cliente');
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(deleteRepairOrder).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Archivar orden' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Archivar orden' })).getByRole('button', { name: 'Archivar' }));
    expect(deleteRepairOrder).toHaveBeenCalledWith('95');
    expect(close).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Orden archivada');
  });

  it('keeps the budget form open and shows the Spanish error when saving fails', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockRejectedValue(new Error('No tenés permiso para esta acción'));
    desk(<RepairOrderEditor id="95" busy={false} />);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('No tenés permiso para esta acción')).toBeInTheDocument();
    expect(screen.getByLabelText('Presupuesto')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });

  it('disables budget and delete for a member without sensitive actions', async () => {
    desk(<RepairOrderEditor id="95" busy={false} />, false);
    expect(screen.getByLabelText('Presupuesto')).toBeDisabled();
    expect(screen.getByLabelText('Seña')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archivar orden' })).toBeDisabled();
    expect(screen.getByText('Solo quien tiene Acciones sensibles puede cambiar el presupuesto, la seña o archivar la orden.')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.not.objectContaining({ estimate: expect.anything() }));
    expect(updateRepairOrder.mock.calls[0]?.[1]).not.toHaveProperty('deposit');
  });

  it('shows the order currency in the store format and keeps it when the amount does not change', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockResolvedValue(order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' }));
    state.repairOrders = [order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' })];
    deskMoney(<RepairOrderDetail id="95" busy={false} />, ARS);
    expect(screen.getByText('$ 100.000')).toBeInTheDocument();
    expect(screen.getByText('$ 10.000')).toBeInTheDocument();
    expect(screen.queryByLabelText('Presupuesto')).not.toBeInTheDocument();
    deskMoney(<RepairOrderEditor id="95" busy={false} />, ARS);
    expect(screen.getByLabelText('Presupuesto')).toHaveValue('100.000');
    expect(screen.getByLabelText('Seña')).toHaveValue('10.000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.objectContaining({ estimate: 100, deposit: 10, currency: 'USD' }));
  });

  it('stamps the store currency when the displayed budget changes', async () => {
    const user = userEvent.setup();
    updateRepairOrder.mockResolvedValue(order('95', 'ESPERANDO_REPUESTO'));
    state.repairOrders = [order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' })];
    deskMoney(<RepairOrderEditor id="95" busy={false} />, ARS);
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '200000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.objectContaining({ estimate: 200000, deposit: 10000, currency: 'ARS' }));
  });

  it('keeps the saved currency and explains when there is no quote to convert a new amount', async () => {
    const user = userEvent.setup();
    state.repairOrders = [order('95', 'ESPERANDO_REPUESTO', { estimate: 100, deposit: 10, currency: 'USD' })];
    deskMoney(<RepairOrderDetail id="95" busy={false} />, { ...ARS, manualBuy: null, manualSell: null });
    expect(screen.getByText('US$ 100')).toBeInTheDocument();
    expect(screen.getByText('US$ 10')).toBeInTheDocument();
    deskMoney(<RepairOrderEditor id="95" busy={false} />, { ...ARS, manualBuy: null, manualSell: null });
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '200');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText(FX_WARNING)).toBeInTheDocument();
    expect(updateRepairOrder).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('opens the shared context menu from the board and the list, and keeps drag from opening it', async () => {
    const user = userEvent.setup();
    desk(<ServiceScreen />);
    vi.useFakeTimers();
    try {
      const card = screen.getByTestId('repair-card-101');
      fireEvent.pointerDown(card, { clientX: 12, clientY: 16, pointerType: 'mouse', button: 0 });
      fireEvent.dragStart(card, { dataTransfer: dragData() });
      act(() => { vi.advanceTimersByTime(600); });
      expect(open).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
    fireEvent.contextMenu(screen.getByTestId('repair-card-95'), { clientX: 40, clientY: 80 });
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'ot', id: '95', label: '#OT-0095 · iPhone 14' }));
    await user.click(screen.getByRole('button', { name: 'Lista' }));
    fireEvent.contextMenu(screen.getByTestId('repair-row-101'), { clientX: 90, clientY: 140 });
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ctx', kind: 'ot', id: '101', label: '#OT-0101 · iPhone 12' }));
  });

  it('closes the repair menu with Escape and a click outside, and deletes after confirming', async () => {
    const user = userEvent.setup();
    const menu = { type: 'ctx' as const, kind: 'ot' as const, id: '95', label: '#OT-0095 · iPhone 14', x: 24, y: 36 };
    desk(<DeskOverlays overlay={menu} />);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(open).toHaveBeenCalledWith({ type: 'edit-ot', id: '95' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(close).toHaveBeenCalled();
    fireEvent.mouseDown(document.querySelector('.ctxov') as HTMLElement);
    expect(close).toHaveBeenCalledTimes(2);

    cleanup();
    desk(<DeskOverlays overlay={menu} />, false);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();

    cleanup();
    deleteRepairOrder.mockResolvedValue(undefined);
    desk(<DeskOverlays overlay={{ type: 'del', kind: 'ot', id: '95', label: '#OT-0095 · iPhone 14' }} />);
    expect(screen.getByRole('dialog', { name: 'Archivar orden' })).toHaveTextContent('archivada');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(deleteRepairOrder).not.toHaveBeenCalled();
    cleanup();
    desk(<DeskOverlays overlay={{ type: 'del', kind: 'ot', id: '95', label: '#OT-0095 · iPhone 14' }} />);
    await user.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(deleteRepairOrder).toHaveBeenCalledWith('95', '');
    expect(toast).toHaveBeenCalledWith('Archivado');
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
    await user.click(screen.getAllByRole('button', { name: 'Más acciones' })[0]);
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'ctx', kind: 'ot', id: '101' }));
    open.mockClear();
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(screen.getByTestId('repair-card-95'), { clientX: 20, clientY: 30, pointerType: 'touch', button: 0 });
      act(() => { vi.advanceTimersByTime(480); });
      expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'ot', id: '95' }));
    } finally {
      vi.useRealTimers();
    }
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

  it('keeps a long fault to three lines on the phone list and the full text in the preview', () => {
    const fault = `${'La pantalla queda negra y el táctil no responde. '.repeat(6)}${'Conector'.repeat(12)}`;
    state.repairOrders = [order('101', 'RECIBIDO', { fault, faultTags: [] })];
    desk(<ServiceScreen />);
    const cardFault = within(screen.getByTestId('repair-card-101')).getByTestId('repair-fault-101');
    expect(cardFault).toHaveClass('svc-fault');
    expect(cardFault).toHaveTextContent(fault);
    expect(screen.queryByTestId('repair-board')).not.toBeInTheDocument();
    cleanup();
    desk(<RepairOrderDetail id="101" busy={false} />);
    const preview = screen.getByTestId('repair-fault');
    expect(preview).toHaveClass('svc-fault-full');
    expect(preview).not.toHaveClass('svc-fault');
    expect(preview).toHaveTextContent(fault);
    expect(preview.closest('.svc-fault-card')).not.toBeNull();
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
    expect(screen.getByText('iPhone 14')).toBeInTheDocument();
    expect(screen.getByTestId('repair-client')).toHaveTextContent('Ejemplo C');
    expect(screen.queryByText('iPhone 14 · Ejemplo C')).not.toBeInTheDocument();
    expect(screen.getByTestId('repair-step')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('repair-step')).toHaveTextContent('sigue');
    expect(screen.getByTestId('repair-step')).toHaveTextContent('Listo para retirar');
    expect(screen.getByText('Cámara trasera borrosa')).toBeInTheDocument();
    expect(screen.getByText('01/01 · atrasada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Historial' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('En reparación').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Tentativo/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar orden' })).not.toBeInTheDocument();

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

  it('shows the selected Recibido state and keeps the status choices', () => {
    desk(<RepairOrderForm busy={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Recibido' })).toHaveClass('on');
    expect(screen.queryByText('Arranca en «Recibido».')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'En diagnóstico' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esperando repuesto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esperando respuesta' })).not.toBeInTheDocument();
    const device = screen.getByLabelText('Equipo');
    const client = screen.getByRole('combobox', { name: 'Cliente (opcional)' });
    expect(device.compareDocumentPosition(client) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    desk(<RepairOrderEditor id="95" busy={false} />);
    await user.clear(screen.getByLabelText('Presupuesto'));
    await user.type(screen.getByLabelText('Presupuesto'), '150000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(updateRepairOrder).toHaveBeenCalledWith('95', expect.objectContaining({ estimate: 150000, deposit: 0, currency: null }));
    expect(screen.getByRole('button', { name: 'Archivar orden' })).toBeEnabled();
  });

  it('shows the deposit warning on the phone sheet', async () => {
    const user = userEvent.setup();
    desk(<RepairOrderForm busy={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Recibido' })).toHaveClass('on');
    await user.type(screen.getByPlaceholderText('iPhone 13'), 'iPhone 13');
    await user.click(screen.getByRole('button', { name: 'Pantalla' }));
    await user.type(screen.getByLabelText('Presupuesto estimado'), '85000');
    await user.clear(screen.getByLabelText('Seña'));
    await user.type(screen.getByLabelText('Seña'), '100000');
    await user.click(screen.getByRole('button', { name: 'Crear orden' }));
    expect(screen.getByText(DEPOSIT_OVER_ESTIMATE)).toBeInTheDocument();
    expect(addRepairOrder).not.toHaveBeenCalled();
  });
});

it.each([false, true])('keeps archived orders red in Todos and hides them in active states (phone: %s)', async phone => {
  const previous = window.matchMedia;
  window.matchMedia = vi.fn(query => ({ media: query, matches: phone && query.includes('max-width'), onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  try {
    state.repairOrders = [order('373', 'RECIBIDO', { archivedAt: '2026-10-22' })];
    const user = userEvent.setup();
    desk(<ServiceScreen />);
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByTestId('repair-card-373')).toHaveClass('is-void');
    if (!phone) {
      await user.click(screen.getByRole('button', { name: 'Lista' }));
      expect(screen.getByTestId('repair-row-373')).toHaveClass('is-void');
    }
    await user.click(screen.getByRole('button', { name: 'Recibido 0' }));
    expect(screen.queryByTestId(phone ? 'repair-card-373' : 'repair-row-373')).not.toBeInTheDocument();
  } finally { cleanup(); window.matchMedia = previous; }
});
