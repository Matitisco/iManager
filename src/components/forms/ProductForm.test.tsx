import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductForm } from './ProductForm';

const mockAppContext = vi.hoisted(() => ({
  addProduct: vi.fn(),
  customColumns: [
    { id: 'provider', label: 'Proveedor', type: 'text', entity: 'inventory', options: undefined as string[] | undefined },
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

  it('limits dropdown custom columns to their fixed options', async () => {
    const user = userEvent.setup();
    const originalColumns = mockAppContext.customColumns;
    mockAppContext.customColumns = [
      ...originalColumns,
      { id: 'estado', label: 'Estado comercial', type: 'enum', options: ['Nuevo', 'Usado'], entity: 'inventory' },
    ];
    mockAppContext.addProduct.mockResolvedValue(undefined);

    try {
      render(<ProductForm onClose={vi.fn()} />);

      const select = screen.getByLabelText('Estado comercial');
      expect(select).toBeInstanceOf(HTMLSelectElement);
      expect(screen.getAllByRole('option', { name: 'Nuevo' }).length).toBeGreaterThan(0);
      await user.selectOptions(select, 'Usado');

      await user.type(screen.getByLabelText('IMEI'), '111222333');
      await user.type(screen.getByLabelText('Modelo'), 'iPhone 15');
      await user.clear(screen.getByLabelText('Color'));
      await user.type(screen.getByLabelText('Color'), 'Negro');
      await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));

      await waitFor(() => {
        expect(mockAppContext.addProduct).toHaveBeenCalledWith(
          expect.objectContaining({
            customFields: { estado: 'Usado' },
          })
        );
      });
    } finally {
      mockAppContext.customColumns = originalColumns;
    }
  });

  it('saves several tags from a multi-tag custom column', async () => {
    const user = userEvent.setup();
    const originalColumns = mockAppContext.customColumns;
    mockAppContext.customColumns = [
      { id: 'labels', label: 'Etiquetas', type: 'tags', entity: 'inventory', options: undefined },
    ];
    mockAppContext.addProduct.mockResolvedValue(undefined);

    try {
      render(<ProductForm onClose={vi.fn()} />);

      await user.type(screen.getByLabelText('IMEI'), '111222333');
      await user.type(screen.getByLabelText('Modelo'), 'iPhone 15');
      await user.clear(screen.getByLabelText('Color'));
      await user.type(screen.getByLabelText('Color'), 'Negro');
      await user.type(screen.getByLabelText('Etiquetas'), 'VIP');
      await user.keyboard('{Enter}');
      await user.type(screen.getByLabelText('Etiquetas'), 'Urgente');
      await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));

      await waitFor(() => {
        expect(mockAppContext.addProduct).toHaveBeenCalledWith(expect.objectContaining({
          customFields: { labels: ['VIP', 'Urgente'] },
        }));
      });
    } finally {
      mockAppContext.customColumns = originalColumns;
    }
  });

  it('blocks a negative cost or price and a model of 500 characters', async () => {
    const user = userEvent.setup();
    render(<ProductForm onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('IMEI'), '111222333');
    await user.type(screen.getByLabelText('Modelo'), 'iPhone 15');
    await user.type(screen.getByLabelText('Color'), 'Negro');
    fireEvent.change(screen.getByLabelText('Costo ($)'), { target: { value: '-10' } });
    await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));

    expect(await screen.findByText('El costo no puede ser negativo')).toBeInTheDocument();
    expect(mockAppContext.addProduct).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Costo ($)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Precio Venta ($)'), { target: { value: '-20' } });
    await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));
    expect(await screen.findByText('El precio no puede ser negativo')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Precio Venta ($)'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'a'.repeat(500) } });
    await user.click(screen.getByRole('button', { name: 'Guardar Equipo' }));
    expect(await screen.findByText('El modelo puede tener hasta 100 caracteres')).toBeInTheDocument();
    expect(mockAppContext.addProduct).not.toHaveBeenCalled();
  });
});
