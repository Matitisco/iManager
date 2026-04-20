import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaleForm } from './SaleForm';

const mockAppContext = vi.hoisted(() => ({
  clients: [
    { id: 'client-1', name: 'Ana', dni: '12345678' },
  ],
  inventory: [
    { id: 'prod-1', model: 'iPhone 14', capacity: '128GB', imei: 'imei-1', price: 2300, status: 'DISPONIBLE' },
    { id: 'prod-2', model: 'Galaxy S24', capacity: '256GB', imei: 'imei-2', price: 2800, status: 'VENDIDO' },
  ],
  addSale: vi.fn(),
  addClient: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => mockAppContext,
}));

describe('SaleForm', () => {
  beforeEach(() => {
    mockAppContext.clients = [
      { id: 'client-1', name: 'Ana', dni: '12345678' },
    ];
    mockAppContext.inventory = [
      { id: 'prod-1', model: 'iPhone 14', capacity: '128GB', imei: 'imei-1', price: 2300, status: 'DISPONIBLE' },
      { id: 'prod-2', model: 'Galaxy S24', capacity: '256GB', imei: 'imei-2', price: 2800, status: 'VENDIDO' },
    ];
    mockAppContext.addSale.mockReset();
    mockAppContext.addClient.mockReset();
  });

  it('creates a sale for an existing client using the selected product price', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SaleForm onClose={onClose} />);

    await user.selectOptions(screen.getAllByRole('combobox')[2], 'EFECTIVO');
    await user.click(screen.getByRole('button', { name: 'Registrar Venta' }));

    await waitFor(() => {
      expect(mockAppContext.addSale).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          productId: 'prod-1',
          amount: 2300,
          paymentMethod: 'EFECTIVO',
          status: 'COMPLETADA',
          date: expect.any(String),
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('creates a client first when the sale is registered in new-client mode', async () => {
    const user = userEvent.setup();
    mockAppContext.clients = [];
    mockAppContext.addClient.mockResolvedValue({ id: 'client-new' });

    render(<SaleForm onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('DNI / ID'), '44556677');
    await user.type(screen.getByLabelText('Nombre Completo'), 'Nuevo Cliente');
    await user.click(screen.getByRole('button', { name: 'Registrar Venta' }));

    await waitFor(() => {
      expect(mockAppContext.addClient).toHaveBeenCalledWith({
        dni: '44556677',
        name: 'Nuevo Cliente',
        email: '',
        phone: '',
        lastPurchaseDate: 'N/A',
        totalSpent: 0,
        pendingBalance: 0,
      });
      expect(mockAppContext.addSale).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-new',
          productId: 'prod-1',
          amount: 2300,
        })
      );
    });
  });
});
