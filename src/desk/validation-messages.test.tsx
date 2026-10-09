import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Client } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  clients: [] as Client[],
  inventory: [],
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  addClient: vi.fn(),
  updateClient: vi.fn(),
  registerClientPayment: vi.fn(),
  user: null,
  appSession: undefined,
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

function renderOverlay(overlay: Parameters<typeof DeskOverlays>[0]['overlay']) {
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={overlay} />
    </DeskProvider>,
  );
}

describe('desk validation messages', () => {
  it('blocks a 500 character model and a negative sale price before saving equipment', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'new-eq' });

    fireEvent.change(screen.getByPlaceholderText('Ej. iPhone 13'), { target: { value: 'a'.repeat(500) } });
    fireEvent.change(screen.getByPlaceholderText('$ 0'), { target: { value: '150000' } });
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));

    expect(screen.getByText('El modelo puede tener hasta 100 caracteres')).toBeInTheDocument();
    expect(ctx.addProduct).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Ej. iPhone 13'), { target: { value: 'iPhone 13' } });
    fireEvent.change(screen.getByPlaceholderText('$ 0'), { target: { value: '-20' } });
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(screen.getByText('El precio no puede ser negativo')).toBeInTheDocument();
    expect(ctx.addProduct).not.toHaveBeenCalled();
  });

  it('blocks a client name of 300 characters', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'new-cl' });

    fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'a'.repeat(300) } });
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    expect(screen.getByText('El nombre puede tener hasta 120 caracteres')).toBeInTheDocument();
    expect(ctx.addClient).not.toHaveBeenCalled();
  });

  it('blocks a negative payment before registering it', async () => {
    ctx.clients = [{
      id: 'client-1',
      dni: '123',
      name: 'Ana Gómez',
      email: '',
      phone: '',
      lastPurchaseDate: 'N/A',
      totalSpent: 0,
      pendingBalance: 5000,
    }];
    const user = userEvent.setup();
    renderOverlay({ type: 'cl', id: 'client-1' });

    const amount = screen.getByLabelText('Monto');
    await user.clear(amount);
    await user.type(amount, '-');

    expect(screen.getByText('El pago no puede ser negativo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(ctx.registerClientPayment).not.toHaveBeenCalled();
  });
});
