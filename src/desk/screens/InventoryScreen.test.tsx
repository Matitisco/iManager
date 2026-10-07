import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';

const toast = vi.fn();
const context = vi.hoisted(() => ({
  inventory: [] as Product[],
  appSession: { store: { name: 'Tienda Centro' } } as { store?: { name?: string } } | null,
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function item(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    imei: `${id}`.padEnd(15, '0'),
    model: `Modelo ${id}`,
    capacity: '128 GB',
    color: 'Negro',
    condition: 'NUEVO',
    grade: '',
    batteryHealth: '100',
    cost: 10,
    price: Number(id) * 1000,
    status: 'DISPONIBLE',
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
      <InventoryScreen />
    </DeskProvider>,
  );
}

describe('Inventory price list', () => {
  beforeEach(() => {
    toast.mockClear();
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [
      ...Array.from({ length: 11 }, (_, index) => item(String(index + 1))),
      item('20', { model: 'Pixel', color: 'Azul', status: 'VENDIDO', price: 500 }),
    ];
  });

  it('copies every row that matches the current search, filter and sort, including rows off the first page', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, writable: true, value: writeText });
    renderScreen();

    expect(screen.queryByText('Modelo 11')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lista de precios' }));
    const message = screen.getByRole('textbox', { name: 'Mensaje' }) as HTMLTextAreaElement;
    expect(message.value).toContain('Lista de precios — Tienda Centro');
    expect(message.value).toContain('• Modelo 11 · 128 GB — Negro · Nuevo — $ 11.000');
    expect(message.value).toContain('• Pixel · 128 GB — Azul · Nuevo — $ 500');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: 'Disponible' }));
    await user.click(screen.getByRole('button', { name: 'Lista de precios' }));
    expect((screen.getByRole('textbox', { name: 'Mensaje' }) as HTMLTextAreaElement).value).not.toContain('Pixel');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    await user.type(screen.getByPlaceholderText('Buscar modelo o color'), 'azul');
    await user.click(screen.getByRole('button', { name: 'Lista de precios' }));
    expect(screen.getByRole('textbox', { name: 'Mensaje' })).toHaveValue([
      'Lista de precios — Tienda Centro',
      '',
      '• Pixel · 128 GB — Azul · Nuevo — $ 500',
    ].join('\n'));

    await user.click(screen.getByRole('button', { name: 'Copiar mensaje' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith([
      'Lista de precios — Tienda Centro',
      '',
      '• Pixel · 128 GB — Azul · Nuevo — $ 500',
    ].join('\n')));
    expect(toast).toHaveBeenCalledWith('Mensaje copiado');
    expect(screen.queryByRole('dialog', { name: 'Lista de precios' })).not.toBeInTheDocument();
  });

  it('orders the message by the selected price sort and stays disabled when nothing matches', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('2', { model: 'Caro', price: 900000 }),
      item('1', { model: 'Barato', price: 100000 }),
    ];
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Recientes' }));
    await user.click(screen.getByRole('button', { name: 'Precio ↑' }));
    await user.click(screen.getByRole('button', { name: 'Lista de precios' }));
    const value = (screen.getByRole('textbox', { name: 'Mensaje' }) as HTMLTextAreaElement).value;
    expect(value.indexOf('Barato')).toBeLessThan(value.indexOf('Caro'));

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.type(screen.getByPlaceholderText('Buscar modelo o color'), 'inexistente');
    expect(screen.getByRole('button', { name: 'Lista de precios' })).toBeDisabled();
  });
});
