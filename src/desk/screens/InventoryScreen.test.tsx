import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import type { OperationNotification } from '../../services/operations-api';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';

const toast = vi.fn();
const context = vi.hoisted(() => ({
  inventory: [] as Product[],
  appSession: { store: { name: 'Tienda Centro' } } as { store?: { name?: string } } | null,
  operationNotifications: [] as OperationNotification[],
  markNotificationRead: vi.fn(async () => undefined),
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
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
      <InventoryScreen />
    </DeskProvider>,
  );
}

describe('Inventory price list', () => {
  beforeEach(() => {
    toast.mockClear();
    context.markNotificationRead.mockClear();
    context.operationNotifications = [];
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
    await user.click(screen.getByRole('checkbox', { name: 'Usado' }));
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
    await user.click(within(status).getByRole('checkbox', { name: 'Vendido' }));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('1 de 12');
    const chips = document.querySelector('.wchips') as HTMLElement;
    expect(within(chips).getByRole('button', { name: 'Vendido' })).toHaveClass('on');
    expect(within(chips).getByRole('button', { name: 'Disponible' })).not.toHaveClass('on');
    await user.click(within(status).getByRole('checkbox', { name: 'Disponible' }));
    expect(within(chips).getByRole('button', { name: 'Disponible' })).toHaveClass('on');
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    await user.click(within(status).getByRole('checkbox', { name: 'Vendido' }));
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('0 de 12');
    await user.click(within(status).getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(within(chips).getByRole('button', { name: 'Todos' })).toHaveClass('on');

    window.dispatchEvent(new Event('desk-eq-saved'));
    await waitFor(() => expect(screen.getByText('Modelo 1 · 128 GB')).toBeInTheDocument());
    expect(screen.queryByText('Pixel · 128 GB')).not.toBeInTheDocument();
  });

  it('keeps Disponible and Reservado together and clears them from the filtered total', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      ...Array.from({ length: 9 }, (_, index) => item(String(index + 1), { status: 'DISPONIBLE' })),
      item('10', { model: 'Apartado', status: 'RESERVADO' }),
      item('11', { model: 'Salida', status: 'VENDIDO' }),
    ];
    renderScreen();

    expect(screen.getByTestId('inventory-total')).toHaveTextContent('11 de 11');
    expect(screen.getByText('1–8 de 11')).toBeInTheDocument();
    const chips = document.querySelector('.wchips') as HTMLElement;
    await user.click(within(chips).getByRole('button', { name: 'Disponible' }));
    await user.click(within(chips).getByRole('button', { name: 'Reservado' }));
    expect(within(chips).getByRole('button', { name: 'Disponible' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'Reservado' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1–8 de 10')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('10 de 11');
    expect(screen.queryByText('Salida · 128 GB')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByText('Apartado · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Salida · 128 GB')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('11 de 11');
    expect(within(chips).getByRole('button', { name: 'Todos' })).toHaveClass('on');
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('sorts the quality column from A+ to C and filters several grades', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Charlie', condition: 'USADO', grade: 'C', price: 300 }),
      item('2', { model: 'Plus', condition: 'USADO', grade: 'A+', price: 100 }),
      item('3', { model: 'Nuevo', condition: 'NUEVO', grade: 'A+', price: 200 }),
    ];
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Ordenar por calidad' }));
    const models = screen.getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    expect(models[0]).toContain('Plus');
    expect(models[1]).toContain('Charlie');
    expect(models[2]).toContain('Nuevo');

    await user.click(screen.getByRole('button', { name: 'Filtrar calidad' }));
    const quality = screen.getByRole('dialog', { name: 'Filtrar calidad' });
    await user.click(within(quality).getByRole('checkbox', { name: 'A+' }));
    await user.click(within(quality).getByRole('checkbox', { name: 'B' }));
    expect(screen.getByText('Plus · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Charlie · 128 GB')).not.toBeInTheDocument();
    expect(screen.queryByText('Nuevo · 128 GB')).not.toBeInTheDocument();
  });
});

describe('Inventory novedades', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    context.markNotificationRead.mockClear();
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [
      item('1', { model: 'iPhone 13', status: 'VENDIDO' }),
      item('2', { model: 'Pixel', status: 'DISPONIBLE' }),
    ];
    context.operationNotifications = [{
      id: 'n1',
      storeId: 's',
      section: 'inventory',
      title: 'Equipo vendido',
      message: 'iPhone 13 vendido',
      recordId: '1',
      kind: 'INTEGRATED_OPERATION',
      createdAt: '2026-10-08T12:00:00.000Z',
      readAt: null,
    }];
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('highlights the affected row, filters to novedades, and marks the note read once the row is shown', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const row = screen.getByText('iPhone 13 · 128 GB').closest('tr') as HTMLElement;
    expect(row).toHaveClass('novedad');
    expect(within(row).getByTestId('notice-reason')).toHaveTextContent('Vendido');
    expect(screen.getByTestId('section-notices')).toHaveTextContent('1 novedad');
    await waitFor(() => expect(context.markNotificationRead).toHaveBeenCalledWith('n1'));

    await user.click(screen.getByTestId('section-notices'));
    expect(screen.getByTestId('section-notices')).toHaveTextContent('Ver todas');
    expect(screen.queryByText('Pixel · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByText('iPhone 13 · 128 GB')).toBeInTheDocument();
  });

  it('shows the same reason on the phone list', () => {
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
    renderScreen();
    const list = screen.getByTestId('phone-rows');
    expect(within(list).getByText('iPhone 13 · 128 GB')).toBeInTheDocument();
    expect(within(list).getByTestId('notice-reason')).toHaveTextContent('Vendido');
    expect(screen.queryByRole('columnheader', { name: /Equipo/ })).not.toBeInTheDocument();
  });
});

function usePhone() {
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
}

describe('Inventory phone list', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [];
    context.operationNotifications = [];
    usePhone();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('shows the empty state and keeps the price list inside the header menu', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    expect(screen.getByTestId('inventory-empty')).toHaveTextContent('Todavía no cargaste equipos');
    expect(screen.getByText('0 resultados')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Equipo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lista de precios' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('button', { name: 'Lista de precios' })).toBeDisabled();
  });

  it('renders the card, searches by IMEI and applies the filter sheet', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'iPhone 13', imei: '490154203237518', capacity: '128GB', color: 'Medianoche', condition: 'USADO', grade: 'A', batteryHealth: '96%', price: 650000 }),
      item('2', { model: 'Pixel', imei: '350000000000020', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '83-85%', price: 150000, status: 'VENDIDO' }),
    ];
    renderScreen();
    const card = screen.getByText('iPhone 13 · 128GB').closest('button') as HTMLElement;
    expect(within(card).getByText('IMEI 49 015420 323751 8')).toBeInTheDocument();
    expect(within(card).getByText('Usado · Medianoche')).toBeInTheDocument();
    expect(within(card).getByText('Calidad A · Bat. 96%')).toBeInTheDocument();
    expect(within(card).getByText('$ 650.000')).toBeInTheDocument();
    expect(within(card).getByText('Disponible')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.type(screen.getByPlaceholderText('Buscar por IMEI, modelo o color'), '490154203237518');
    expect(screen.getByText('iPhone 13 · 128GB')).toBeInTheDocument();
    expect(screen.queryByText('Pixel · 128 GB')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Buscar por IMEI, modelo o color'));
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('button', { name: '≥ 90%' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('iPhone 13 · 128GB')).toBeInTheDocument();
    expect(screen.queryByText(/Pixel/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros' }).parentElement).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('button', { name: 'Lista de precios' }));
    expect(screen.getByRole('dialog', { name: 'Lista de precios' })).toBeInTheDocument();
  });

  it('selects several statuses from the sliding chips and the filter sheet', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Libre', status: 'DISPONIBLE' }),
      item('2', { model: 'Apartado', status: 'RESERVADO' }),
      item('3', { model: 'Salida', status: 'VENDIDO' }),
    ];
    renderScreen();

    expect(screen.getByTestId('inventory-total')).toHaveTextContent('3 de 3');
    const chips = document.querySelector('.wchips') as HTMLElement;
    await user.click(within(chips).getByRole('button', { name: 'Disponible' }));
    await user.click(within(chips).getByRole('button', { name: 'Reservado' }));
    expect(screen.getByText('Libre · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Apartado · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Salida · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('2 de 3');

    await user.click(within(chips).getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('Salida · 128 GB')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('3 de 3');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('checkbox', { name: 'Disponible' }));
    await user.click(within(sheet).getByRole('checkbox', { name: 'Reservado' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.queryByText('Salida · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('2 de 3');
    expect(within(chips).getByRole('button', { name: 'Disponible' })).toHaveClass('on');
    expect(within(chips).getByRole('button', { name: 'Reservado' })).toHaveClass('on');
    expect(screen.getByRole('button', { name: 'Filtros' }).parentElement).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const again = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(again).getByRole('button', { name: 'Limpiar filtros' }));
    await user.click(within(again).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('Salida · 128 GB')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('3 de 3');
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('sorts cards by quality and filters several grades from the sheet', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Charlie', condition: 'USADO', grade: 'C', price: 300 }),
      item('2', { model: 'Plus', condition: 'USADO', grade: 'A+', price: 100 }),
      item('3', { model: 'Nuevo', condition: 'NUEVO', grade: 'A+', price: 200 }),
    ];
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Recientes' }));
    await user.click(screen.getByRole('button', { name: 'Calidad ↑' }));
    const cards = [...document.querySelectorAll('.phone-row')].map((row) => row.textContent ?? '');
    expect(cards[0]).toContain('Plus');
    expect(cards[1]).toContain('Charlie');
    expect(cards[2]).toContain('Nuevo');
    expect(cards[2]).not.toContain('Calidad');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('checkbox', { name: 'A+ · Como nuevo' }));
    await user.click(within(sheet).getByRole('checkbox', { name: 'B · Bueno' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('Plus · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Charlie · 128 GB')).not.toBeInTheDocument();
    expect(screen.queryByText('Nuevo · 128 GB')).not.toBeInTheDocument();
  });
});
