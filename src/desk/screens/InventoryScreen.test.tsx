import type { SectionChanges } from '../../services/section-views-api';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import type { OperationNotification } from '../../services/operations-api';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';

const toast = vi.fn();
const context = vi.hoisted(() => ({
  sectionChanges: {} as SectionChanges,
  viewSection: vi.fn(async () => undefined),
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

describe('Inventory column filters', () => {
  beforeEach(() => {
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [
      ...Array.from({ length: 11 }, (_, index) => item(String(index + 1), { batteryHealth: '96' })),
      item('20', { model: 'Pixel', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '83-85%', status: 'VENDIDO', price: 150000 }),
    ];
  });

  it('conserva el título y el contador de tabla sin subtítulo', () => {
    context.inventory = [item('1')];
    renderScreen();
    expect(screen.getByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(screen.queryByText('1 equipo · 1 disponible · 0 en catálogo')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 1')).toBeInTheDocument();
  });

  it('filters the table by each column, including rows off the first page', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Filtrar batería' }));
    const battery = screen.getByRole('dialog', { name: 'Filtrar batería' });
    await user.click(within(battery).getByRole('button', { name: '≥ 90%' }));
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
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

  it('shows the color column, sorts it and filters several colors', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Verde', color: 'Verde' }),
      item('2', { model: 'Azul', color: 'Azul' }),
      item('3', { model: 'Sin', color: '   ' }),
      item('4', { model: 'Negro', color: 'Negro' }),
    ];
    renderScreen();

    expect(screen.getByRole('columnheader', { name: /Color/ })).toBeInTheDocument();
    const azul = screen.getByText('Azul · 128 GB').closest('tr') as HTMLElement;
    expect(within(azul).getByRole('cell', { name: 'Azul' })).toBeInTheDocument();
    const blank = screen.getByText('Sin · 128 GB').closest('tr') as HTMLElement;
    expect(within(blank).getAllByRole('cell', { name: '—' }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ordenar por color' }));
    const ascending = screen.getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    expect(ascending.map((row) => row.includes('Azul') ? 'Azul' : row.includes('Negro') ? 'Negro' : row.includes('Verde') ? 'Verde' : 'Sin')).toEqual(['Azul', 'Negro', 'Verde', 'Sin']);

    await user.click(screen.getByRole('button', { name: 'Ordenar por color' }));
    const descending = screen.getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    expect(descending.map((row) => row.includes('Azul') ? 'Azul' : row.includes('Negro') ? 'Negro' : row.includes('Verde') ? 'Verde' : 'Sin')).toEqual(['Verde', 'Negro', 'Azul', 'Sin']);

    await user.click(screen.getByRole('button', { name: 'Filtrar color' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar color' });
    expect(within(dialog).queryByRole('checkbox', { name: '—' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Azul' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Negro' }));
    expect(screen.getByText('Azul · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Negro · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Verde · 128 GB')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin · 128 GB')).not.toBeInTheDocument();
  });

  it('offers Nuevo and Usado, plus any stock condition, even when the table is empty', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [];
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Filtrar condición' }));
    const condition = screen.getByRole('dialog', { name: 'Filtrar condición' });
    expect(within(condition).getByRole('checkbox', { name: 'Nuevo' })).toBeInTheDocument();
    expect(within(condition).getByRole('checkbox', { name: 'Usado' })).toBeInTheDocument();
    expect(within(condition).queryByText('Todavía no hay condiciones en el stock.')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Filtrar calidad' }));
    const quality = screen.getByRole('dialog', { name: 'Filtrar calidad' });
    for (const name of ['A+', 'A', 'B', 'C']) {
      expect(within(quality).getByRole('checkbox', { name: (value) => value === name })).toBeInTheDocument();
    }
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Filtrar estado' }));
    const status = screen.getByRole('dialog', { name: 'Filtrar estado' });
    for (const name of ['Disponible', 'En revisión', 'Reservado', 'Vendido']) {
      expect(within(status).getByRole('checkbox', { name })).toBeInTheDocument();
    }
  });

  it('filters several conditions at once and counts stock outside the base catalog', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Sellado', condition: 'NUEVO' }),
      item('2', { model: 'Recambio', condition: 'USADO', grade: 'B' }),
      item('3', { model: 'Heredado', condition: 'PRE-OWNED' }),
    ];
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Filtrar condición' }));
    const condition = screen.getByRole('dialog', { name: 'Filtrar condición' });
    expect(within(condition).getByRole('checkbox', { name: 'Pre-owned' })).toBeInTheDocument();
    await user.click(within(condition).getByRole('checkbox', { name: 'Nuevo' }));
    await user.click(within(condition).getByRole('checkbox', { name: 'Pre-owned' }));
    expect(screen.getByText('Sellado · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Heredado · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Recambio · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('2 de 3');
  });
});

describe('Inventory novedades', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    context.markNotificationRead.mockClear();
    context.sectionChanges = { inventory: [{ id: '1', updatedAt: '2026-10-08T12:00:00.000Z' }] };
    context.viewSection.mockClear();
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
    context.sectionChanges = {};
    window.matchMedia = originalMatchMedia;
  });

  it('prioritizes and marks changed rows without adding reason text or a banner', async () => {
    renderScreen();
    const row = screen.getByText('iPhone 13 · 128 GB').closest('tr') as HTMLElement;
    expect(row).toHaveClass('novedad');
    expect(within(row).getByTestId('notice-dot')).toBeEmptyDOMElement();
    expect(screen.queryByTestId('section-notices')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notice-reason')).not.toBeInTheDocument();
    await waitFor(() => expect(context.viewSection).toHaveBeenCalledWith('inventory', context.sectionChanges.inventory));
    expect(screen.getByText('Pixel · 128 GB')).toBeInTheDocument();
    expect(context.markNotificationRead).not.toHaveBeenCalled();
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
    expect(within(list).getByTestId('notice-dot')).toHaveAccessibleName('Novedad');
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

describe('Inventory empty store', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [];
    context.operationNotifications = [];
  });

  it('shows the onboarding empty state on desktop until a filter or search is active', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const open = vi.fn();
    render(
      <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
        <InventoryScreen />
      </DeskProvider>,
    );

    const empty = screen.getByTestId('inventory-empty');
    expect(empty).toHaveTextContent('Todavía no cargaste equipos');
    expect(empty).toHaveTextContent('Ingresá tu primer equipo o importá tu stock desde una planilla.');
    expect(empty).toHaveTextContent('0 resultados');
    expect(within(empty).queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument();
    expect(within(empty).queryByRole('button', { name: 'Registrar equipo' })).not.toBeInTheDocument();
    expect(screen.queryByText('No hay equipos con ese filtro.')).not.toBeInTheDocument();
    expect(screen.queryByText(/mantené apretada una fila/)).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Equipo/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(open).toHaveBeenCalledWith({ type: 'import', kind: 'inv' });
    await user.click(screen.getByRole('button', { name: 'Registrar equipo' }));
    expect(open).toHaveBeenCalledWith({ type: 'new-eq' });

    await user.click(screen.getByRole('button', { name: 'Disponible' }));
    expect(screen.queryByTestId('inventory-empty')).not.toBeInTheDocument();
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByTestId('inventory-empty')).toHaveTextContent('Todavía no cargaste equipos');

    await user.type(screen.getByPlaceholderText('Buscar modelo o color'), 'pixel');
    expect(screen.queryByTestId('inventory-empty')).not.toBeInTheDocument();
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
  });
});

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

  it('shows the empty state without row export actions', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    const empty = screen.getByTestId('inventory-empty');
    expect(empty).toHaveTextContent('Todavía no cargaste equipos');
    expect(within(empty).getByRole('button', { name: 'Importar' })).toBeInTheDocument();
    expect(within(empty).getByRole('button', { name: 'Registrar equipo' })).toBeInTheDocument();
    expect(screen.getByText('0 resultados')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Equipo/ })).not.toBeInTheDocument();
  });

  it('uses the filter copy on an empty store once a chip or the search is active', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    expect(screen.getByTestId('inventory-empty')).toHaveTextContent('Todavía no cargaste equipos');
    expect(screen.queryByText(/Tocá ⋯ en una fila/)).not.toBeInTheDocument();

    const menu = screen.getByTestId('inventory-status-filter');
    await user.click(within(menu).getByRole('button', { name: 'Estado' }));
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Vendido' }));
    expect(screen.queryByTestId('inventory-empty')).not.toBeInTheDocument();
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();

    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Todos' }));
    expect(screen.getByTestId('inventory-empty')).toHaveTextContent('Todavía no cargaste equipos');

    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.type(screen.getByPlaceholderText('Buscar por IMEI, modelo o color'), 'pixel');
    expect(screen.queryByTestId('inventory-empty')).not.toBeInTheDocument();
    expect(screen.getByText('No hay equipos con ese filtro.')).toBeInTheDocument();
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
    const menu = screen.getByTestId('inventory-status-filter');
    await user.click(within(menu).getByRole('button', { name: 'Estado' }));
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Disponible' }));
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Reservado' }));
    expect(screen.getByText('Libre · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Apartado · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Salida · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('2 de 3');

    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Todos' }));
    expect(screen.getByText('Salida · 128 GB')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('3 de 3');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('checkbox', { name: 'Disponible' }));
    await user.click(within(sheet).getByRole('checkbox', { name: 'Reservado' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.queryByText('Salida · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('2 de 3');
    expect(menu).toHaveClass('on');
    expect(within(menu).getByRole('button', { name: '2 estados' })).toBeInTheDocument();
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

  it('sorts the cards by color and filters several colors from the sheet', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Verde', color: 'Verde' }),
      item('2', { model: 'Azul', color: 'Azul' }),
      item('3', { model: 'Sin', color: '' }),
      item('4', { model: 'Negro', color: 'Negro' }),
    ];
    renderScreen();

    const azul = screen.getByText('Azul · 128 GB').closest('button') as HTMLElement;
    expect(within(azul).getByText('Nuevo · Azul')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recientes' }));
    await user.click(screen.getByRole('button', { name: 'Color ↑' }));
    const ascending = [...document.querySelectorAll('.phone-row')].map((row) => row.textContent ?? '');
    expect(ascending[0]).toContain('Azul');
    expect(ascending[1]).toContain('Negro');
    expect(ascending[2]).toContain('Verde');
    expect(ascending[3]).toContain('Sin');

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('checkbox', { name: 'Azul' }));
    await user.click(within(sheet).getByRole('checkbox', { name: 'Negro' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('Azul · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Negro · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Verde · 128 GB')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros' }).parentElement).toHaveTextContent('1');
  });

  it('shows condition, quality and status choices in the sheet when there are no devices', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    expect(within(sheet).getByRole('checkbox', { name: 'Nuevo' })).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: 'Usado' })).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: 'A+ · Como nuevo' })).toBeInTheDocument();
    expect(within(sheet).getByRole('checkbox', { name: 'Disponible' })).toBeInTheDocument();
    expect(within(sheet).queryByText('Todavía no hay condiciones en el stock.')).not.toBeInTheDocument();
    expect(within(sheet).getByText('Todavía no hay colores en el stock.')).toBeInTheDocument();
  });

  it('applies several conditions from the sheet and updates the filtered total', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Sellado', condition: 'NUEVO' }),
      item('2', { model: 'Recambio', condition: 'USADO' }),
      item('3', { model: 'Heredado', condition: 'PRE-OWNED' }),
    ];
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    expect(within(sheet).getByRole('checkbox', { name: 'Pre-owned' })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('checkbox', { name: 'Nuevo' }));
    await user.click(within(sheet).getByRole('checkbox', { name: 'Usado' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('Sellado · 128 GB')).toBeInTheDocument();
    expect(screen.getByText('Recambio · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Heredado · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('2 de 3');
    expect(screen.getByRole('button', { name: 'Filtros' }).parentElement).toHaveTextContent('1');
  });

  it('filters equipment marked for completion from the phone sheet', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    context.inventory = [
      item('1', { model: 'Listo', needsCompletion: false }),
      item('2', { model: 'Incompleto', needsCompletion: true, status: 'VENDIDO' }),
    ];
    renderScreen();

    const badge = screen.getByTestId('needs-completion');
    expect(badge).toHaveTextContent('Para completar');
    expect(badge.closest('.inv-card')).not.toBeNull();
    expect(badge.tagName).toBe('SMALL');
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    const completion = within(sheet).getByRole('checkbox', { name: 'Solo equipos para completar' });
    const disponible = within(sheet).getByRole('checkbox', { name: 'Disponible' });
    expect(completion.closest('.inv-checks')).not.toBeNull();
    expect(completion.closest('label')).toHaveClass('chk');
    expect(disponible.closest('label')).toHaveClass('chk');
    await user.click(completion);
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('Incompleto · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Listo · 128 GB')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('1 de 2');
  });

  it('renders the completion tag as a chip and the filter checkbox like the others', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const style = document.createElement('style');
    style.textContent = `${readFileSync(path.resolve(process.cwd(), 'src/desk/desk.css'), 'utf8')}\n.mtools { display: flex !important; }`;
    document.head.appendChild(style);
    context.inventory = [
      item('2', { model: 'Incompleto', needsCompletion: true, status: 'VENDIDO' }),
    ];
    try {
      renderScreen();
      const badge = screen.getByTestId('needs-completion');
      const badgeStyle = getComputedStyle(badge);
      expect(badgeStyle.color).toBe('rgb(154, 52, 18)');
      expect(badgeStyle.fontSize).toBe('11px');
      expect(badgeStyle.fontWeight).toBe('700');
      expect(badgeStyle.width).toBe('fit-content');
      expect(badgeStyle.alignSelf).toBe('flex-start');
      expect(badgeStyle.display).toBe('inline-flex');

      await user.click(screen.getByRole('button', { name: 'Filtros' }));
      const sheet = screen.getByRole('dialog', { name: 'Filtros' });
      const completion = within(sheet).getByRole('checkbox', { name: 'Solo equipos para completar' }).closest('label');
      const disponible = within(sheet).getByRole('checkbox', { name: 'Disponible' }).closest('label');
      expect(completion).not.toBeNull();
      expect(disponible).not.toBeNull();
      const completionStyle = getComputedStyle(completion!);
      const statusStyle = getComputedStyle(disponible!);
      expect(completionStyle.display).toBe('flex');
      expect(completionStyle.gap).toBe('8px');
      expect(completionStyle.fontSize).toBe('14px');
      expect(completionStyle.fontWeight).toBe('700');
      expect(completionStyle.gap).toBe(statusStyle.gap);
      expect(completionStyle.fontSize).toBe(statusStyle.fontSize);
      expect(completionStyle.fontWeight).toBe(statusStyle.fontWeight);
      expect(getComputedStyle(completion!.querySelector('input')!).width).toBe(getComputedStyle(disponible!.querySelector('input')!).width);
    } finally {
      style.remove();
    }
  });
});

describe('Inventory filter panel draft and color search', () => {
  beforeEach(() => {
    usePhone();
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.operationNotifications = [];
    context.inventory = [
      item('1', { model: 'Histórico', color: 'Azul océano / Plata', status: 'EN_REVISION' }),
      item('2', { model: 'Otra variante', color: 'AZUL OCEANO / PLATA' }),
      ...['Negro', 'Verde', 'Rojo', 'Rosa', 'Dorado', 'Blanco'].map((color, i) => item(String(i + 3), { color })),
    ];
  });

  it('folds long color lists after price and preserves selections through searches with no matches', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtros' });
    const colors = sheet.querySelector('details')!;
    expect(colors).not.toHaveAttribute('open');
    expect(sheet.querySelector('.inv-range')!.compareDocumentPosition(colors) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(within(sheet).getByText('Color · 0 seleccionados'));
    const search = within(sheet).getByRole('searchbox', { name: 'Buscar color' });
    await user.type(search, 'oceano');
    const historical = within(sheet).getByRole('checkbox', { name: 'Azul océano / Plata' });
    await user.click(historical.closest('label')!);
    expect(historical).toBeChecked();
    expect(within(sheet).getByRole('checkbox', { name: 'AZUL OCEANO / PLATA' })).not.toBeChecked();
    await user.clear(search);
    await user.type(search, 'sin coincidencias');
    expect(within(sheet).getByText('No hay colores con esa búsqueda. Probá otro nombre.')).toBeInTheDocument();
    expect(within(sheet).getByText('Color · 1 seleccionado')).toBeInTheDocument();
    expect(within(sheet).getByText('1 filtro seleccionado')).toBeInTheDocument();
    await user.clear(search);
    expect(within(sheet).getByRole('checkbox', { name: 'Azul océano / Plata' })).toBeChecked();
    expect(colors.querySelectorAll('input[type="checkbox"]')).toHaveLength(8);
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('1 de 8');
    expect(screen.getByText('Histórico · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Otra variante · 128 GB')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    const reopened = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(reopened).getByText('Color · 1 seleccionado'));
    expect(within(reopened).getByRole('searchbox', { name: 'Buscar color' })).toHaveValue('');
    expect(within(reopened).getByRole('checkbox', { name: 'Azul océano / Plata' })).toBeChecked();
  });

  it.each(['Cerrar', 'Escape', 'fondo'])('discards unconfirmed edits and clearing when closing by %s', async (method) => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    let sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('checkbox', { name: 'En revisión' }).closest('label')!);
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('1 de 8');
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    sheet = screen.getByRole('dialog', { name: 'Filtros' });
    await user.click(within(sheet).getByRole('button', { name: 'Limpiar filtros' }));
    expect(within(sheet).getByText('0 filtros seleccionados')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('checkbox', { name: 'Solo equipos para completar' }).closest('label')!);
    await user.click(within(sheet).getByRole('button', { name: '≥ 90%' }));
    await user.type(within(sheet).getByRole('textbox', { name: 'Máximo' }), '5000');
    if (method === 'Escape') await user.keyboard('{Escape}');
    else if (method === 'fondo') await user.click(sheet.parentElement!);
    else await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog', { name: 'Filtros' })).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('1 de 8');
    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    sheet = screen.getByRole('dialog', { name: 'Filtros' });
    expect(within(sheet).getByRole('checkbox', { name: 'En revisión' })).toBeChecked();
    expect(within(sheet).getByRole('checkbox', { name: 'Solo equipos para completar' })).not.toBeChecked();
    expect(within(sheet).getByRole('textbox', { name: 'Máximo' })).toHaveValue('');
    expect(within(sheet).getByRole('button', { name: '≥ 90%' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(sheet).getByRole('button', { name: 'Limpiar filtros' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByTestId('inventory-total')).toHaveTextContent('8 de 8');
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });
});

describe('Inventory para completar', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    context.appSession = { store: { name: 'Tienda Centro' } };
    context.inventory = [
      item('1', { model: 'Listo' }),
      item('2', { model: 'Incompleto', needsCompletion: true, status: 'VENDIDO', color: 'Rosa' }),
    ];
    context.operationNotifications = [];
  });

  it('shows the marker and filters it from the desktop chips and column filter', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    renderScreen();

    const row = screen.getByText('Incompleto · 128 GB').closest('tr') as HTMLElement;
    expect(within(row).getByTestId('needs-completion')).toHaveTextContent('Para completar');
    expect(screen.getByText('Listo · 128 GB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Para completar' }));
    expect(screen.getByText('Incompleto · 128 GB')).toBeInTheDocument();
    expect(screen.queryByText('Listo · 128 GB')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(screen.getByText('Listo · 128 GB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtrar estado' }));
    const status = screen.getByRole('dialog', { name: 'Filtrar estado' });
    await user.click(within(status).getByRole('checkbox', { name: 'Para completar' }));
    expect(screen.queryByText('Listo · 128 GB')).not.toBeInTheDocument();
  });
});
