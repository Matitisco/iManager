import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductForm } from './ProductForm';

const mockAppContext = vi.hoisted(() => ({
  addProduct: vi.fn(),
  customColumns: [
    { id: 'provider', label: 'Proveedor', type: 'text', entity: 'inventory' },
  ],
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => mockAppContext,
}));

describe('ProductForm', () => {
  beforeEach(() => {
    mockAppContext.addProduct.mockReset();
  });

  it('validates key required fields before saving', async () => {
    const user = userEvent.setup();
    render(<ProductForm onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('IMEI'), '   ');
    await user.type(screen.getByLabelText('Modelo'), '   ');
    await user.type(screen.getByLabelText('Color'), '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));

    expect(await screen.findByText(/imei.*modelo.*color/i)).toBeInTheDocument();
    expect(mockAppContext.addProduct).not.toHaveBeenCalled();
  });

  it('submits normalized product data including custom fields', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockAppContext.addProduct.mockResolvedValue(undefined);

    render(<ProductForm onClose={onClose} />);

    await user.type(screen.getByLabelText('IMEI'), ' 111222333 ');
    await user.type(screen.getByLabelText('Modelo'), ' iPhone 15 ');
    await user.clear(screen.getByLabelText('Color'));
    await user.type(screen.getByLabelText('Color'), ' Negro ');
    await user.clear(screen.getByLabelText('Costo ($)'));
    await user.type(screen.getByLabelText('Costo ($)'), '1000');
    await user.clear(screen.getByLabelText('Precio Venta ($)'));
    await user.type(screen.getByLabelText('Precio Venta ($)'), '1500');
    const batteryInput = screen.getByPlaceholderText('ej: 83-85% o 100');
    await user.clear(batteryInput);
    await user.type(batteryInput, '96%');
    await user.type(screen.getByLabelText('Proveedor'), 'Mayorista Uno');
    await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));

    await waitFor(() => {
      expect(mockAppContext.addProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          imei: '111222333',
          model: 'iPhone 15',
          color: 'Negro',
          cost: 1000,
          price: 1500,
          batteryHealth: '96%',
          status: 'DISPONIBLE',
          customFields: {
            provider: 'Mayorista Uno',
          },
        })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
