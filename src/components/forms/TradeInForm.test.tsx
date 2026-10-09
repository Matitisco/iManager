import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TradeInForm } from './TradeInForm';

const mockAppContext = vi.hoisted(() => ({
  clients: [
    { id: 'client-1', name: 'Ana', dni: '12345678' },
  ],
  inventory: [
    { id: 'prod-1', model: 'iPhone 14', capacity: '128GB', imei: 'imei-1', price: 2300, status: 'DISPONIBLE' },
  ],
  addTradeIn: vi.fn(),
  addClient: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => mockAppContext,
}));

describe('TradeInForm', () => {
  beforeEach(() => {
    mockAppContext.addTradeIn.mockReset();
    mockAppContext.addClient.mockReset();
  });

  it('requires the received device information before submitting', async () => {
    const user = userEvent.setup();
    render(<TradeInForm onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Equipo Recibido'), '   ');
    await user.type(screen.getByLabelText('IMEI (opcional)'), '   ');
    await user.click(screen.getByRole('button', { name: 'Registrar Canje' }));

    expect(await screen.findByText('Completá el equipo recibido.')).toBeInTheDocument();
    expect(mockAppContext.addTradeIn).not.toHaveBeenCalled();
  });

  it('submits the trade-in using the inventory price to compute the difference', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<TradeInForm onClose={onClose} />);

    await user.type(screen.getByLabelText('Equipo Recibido'), 'iPhone 12');
    await user.type(screen.getByLabelText('IMEI (opcional)'), '350000000000095');
    await user.clear(screen.getByLabelText('Valor de Toma ($)'));
    await user.type(screen.getByLabelText('Valor de Toma ($)'), '900');
    await user.click(screen.getByRole('button', { name: 'Registrar Canje' }));

    await waitFor(() => {
      expect(mockAppContext.addTradeIn).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          deviceReceived: 'iPhone 12',
          deviceReceivedImei: '350000000000095',
          deviceGiven: 'iPhone 14',
          takeValue: 900,
          differencePaid: 1400,
          status: 'PENDIENTE',
          batteryHealth: '100',
          grade: 'A',
          date: expect.any(String),
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
