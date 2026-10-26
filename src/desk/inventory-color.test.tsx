import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[],
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  appSession: { membership: { role: 'OWNER' as const, sections: ['inventory'] } },
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'eq-1',
    imei: '',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Azul',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: 200,
    status: 'DISPONIBLE',
    ...overrides,
  };
}

function renderOverlay(overlay: Parameters<typeof DeskOverlays>[0]['overlay']) {
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={overlay} />
    </DeskProvider>,
  );
}

describe('inventory color', () => {
  beforeEach(() => {
    ctx.inventory = [];
    ctx.addProduct.mockReset();
    ctx.addProduct.mockResolvedValue({ id: 'created' });
    ctx.updateProduct.mockReset();
    ctx.updateProduct.mockResolvedValue(undefined);
  });

  it('shows the stored color on the equipment record', () => {
    ctx.inventory = [product()];
    renderOverlay({ type: 'eq', id: 'eq-1' });
    expect(screen.getByText('Color').closest('.kv')).toHaveTextContent('Azul');
  });

  it('saves a color on create and keeps it optional', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'new-eq' });
    await user.type(screen.getByPlaceholderText('Ej. iPhone 13'), 'Pixel');
    await user.type(screen.getByLabelText('Color'), '  Verde ');
    await user.type(screen.getByPlaceholderText('A definir'), '150000');
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({
      model: 'Pixel',
      color: 'Verde',
    })));
  });

  it('updates the color from the edit form', async () => {
    const user = userEvent.setup();
    ctx.inventory = [product()];
    renderOverlay({ type: 'edit-eq', id: 'eq-1' });
    const color = screen.getByLabelText('Color');
    expect(color).toHaveValue('Azul');
    await user.clear(color);
    await user.type(color, 'Negro');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateProduct).toHaveBeenCalledWith(expect.objectContaining({
      id: 'eq-1',
      color: 'Negro',
    })));
  });

  it('blocks a color longer than the stored column', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'new-eq' });
    fireEvent.change(screen.getByPlaceholderText('Ej. iPhone 13'), { target: { value: 'Pixel' } });
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'a'.repeat(51) } });
    fireEvent.change(screen.getByPlaceholderText('A definir'), { target: { value: '150000' } });
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(screen.getByText('El color puede tener hasta 50 caracteres')).toBeInTheDocument();
    expect(ctx.addProduct).not.toHaveBeenCalled();
  });
});
