import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('Inventory pagination', () => {
  it('shows eight equipment rows, navigates the remainder and recovers after filters or removals', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [
      ...Array.from({ length: 11 }, (_, index) => item(String(index + 1))),
      item('20', { model: 'Pixel', status: 'VENDIDO' }),
    ];
    const { rerender } = renderScreen();
    const visibleRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

    expect(visibleRows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.queryByText('Modelo 11 · 128 GB')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(visibleRows()).toHaveLength(4);
    expect(screen.getByText('Modelo 11 · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('9–12 de 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Buscar modelo o color'), 'Modelo');
    expect(visibleRows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 11')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(visibleRows()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Disponible' }));
    expect(visibleRows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 11')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Modelo 11 · 128 GB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recientes' }));
    await user.click(screen.getByRole('button', { name: 'Precio ↓' }));
    expect(visibleRows()).toHaveLength(8);
    expect(screen.getByText('1–8 de 11')).toBeInTheDocument();
    expect(within(visibleRows()[0]).getByText('Modelo 11 · 128 GB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    context.inventory = context.inventory.slice(0, 8);
    rerender(
      <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
        <InventoryScreen />
      </DeskProvider>,
    );
    expect(visibleRows()).toHaveLength(8);
    expect(screen.getByText('Modelo 1 · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Modelo 11 · 128 GB')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
  });
});

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
    expect(screen.getByText('1–8 de 12')).toBeInTheDocument();
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

describe('Inventory column filters', () => {
  beforeEach(() => {
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [
      ...Array.from({ length: 11 }, (_, index) => item(String(index + 1), { batteryHealth: '96' })),
      item('20', { model: 'Pixel', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '83-85%', status: 'VENDIDO', price: 150000 }),
    ];
  });

  it('filters the table and the price list by each column, including rows off the first page', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();

    expect(screen.queryByText('Pixel · 128 GB')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filtrar equipo' }));
    await user.type(screen.getByRole('textbox', { name: 'Contiene' }), 'pixel');
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Modelo 1 · 128 GB')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    await user.click(screen.getByRole('button', { name: 'Filtrar condición' }));
    await user.click(screen.getByRole('checkbox', { name: 'Usado · Grado A' }));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Modelo 1 · 128 GB')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lista de precios' }));
    expect((screen.getByRole('textbox', { name: 'Mensaje' }) as HTMLTextAreaElement).value).toContain('Pixel');
    expect((screen.getByRole('textbox', { name: 'Mensaje' }) as HTMLTextAreaElement).value).not.toContain('Modelo 1');
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    await user.click(screen.getByRole('button', { name: 'Filtrar batería' }));
    const battery = screen.getByRole('dialog', { name: 'Filtrar batería' });
    await user.click(within(battery).getByRole('button', { name: '≥ 90%' }));
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lista de precios' })).toBeDisabled();
    await user.click(within(battery).getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtrar precio' }));
    const price = screen.getByRole('dialog', { name: 'Filtrar precio' });
    await user.type(within(price).getByRole('textbox', { name: 'Mínimo' }), '200000');
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
    await user.clear(within(price).getByRole('textbox', { name: 'Mínimo' }));
    await user.type(within(price).getByRole('textbox', { name: 'Máximo' }), '150000');
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    await user.click(within(price).getByRole('button', { name: 'Limpiar' }));

    await user.click(screen.getByRole('button', { name: 'Filtrar estado' }));
    const status = screen.getByRole('dialog', { name: 'Filtrar estado' });
    await user.click(within(status).getByRole('button', { name: 'Vendido' }));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(within(document.querySelector('.wchips') as HTMLElement).getByRole('button', { name: 'Vendido' })).toHaveClass('on');
    await user.click(within(status).getByRole('button', { name: 'Disponible' }));
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
    await user.click(within(status).getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();

    window.dispatchEvent(new Event('desk-eq-saved'));
    await waitFor(() => expect(screen.getByText('Modelo 1 · 128 GB')).toBeInTheDocument());
    expect(screen.queryByText('Pixel · 128 GB')).not.toBeInTheDocument();
  });
});
