import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, ClientCategory, CustomColumn, Product, RepairOrder, Sale, TradeIn } from '../../types';
import { ExchangeProvider } from '../exchange';
import { ReportsScreen } from './ReportsScreen';

const context = vi.hoisted(() => ({
  sales: [] as Sale[],
  inventory: [] as Product[],
  tradeIns: [] as TradeIn[],
  clients: [] as Client[],
  repairOrders: [] as RepairOrder[],
  clientCategories: [] as ClientCategory[],
  customColumns: [] as CustomColumn[],
  appSession: null as { membership?: { role?: string; sections?: string[] | null } } | null,
  expenses: [] as Array<{ id: string; date: string; category: string; amount: number; currency: 'ARS' | 'USD'; exchangeRate: number | null; notes: string | null; deletedAt: string | null }>,
  expensesLoaded: true,
}));
const desk = vi.hoisted(() => ({ open: vi.fn(), toast: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../ui', async () => {
  const actual = await vi.importActual<typeof import('../ui')>('../ui');
  return { ...actual, useDesk: () => desk, Pill: ({ status }: { status: string }) => <span>{status}</span> };
});

const sale = (id: string, date: string, amount: number, paymentMethod = 'EFECTIVO', status = 'COMPLETADA'): Sale => ({
  id, date, amount, paymentMethod, status, saleNumber: Number(id), clientId: '', clientName: `Venta ${id}`, productId: '',
});
const product = (id: string, createdAt?: string, status = 'DISPONIBLE'): Product => ({
  id, createdAt, status, model: `Equipo ${id}`, imei: id, capacity: '128 GB', color: 'Negro', condition: 'NUEVO', grade: '', batteryHealth: '100', cost: 100, price: 200,
});
const trade = (id: string, date: string, status = 'PENDIENTE'): TradeIn => ({
  id, date, status, tradeNumber: Number(id), clientId: '', deviceReceived: `Canje ${id}`, deviceReceivedImei: id, takeValue: 100, deviceGiven: 'Otro equipo', differencePaid: 50,
});

async function applyRange(start = '2026-04-01', end = '2026-04-03') {
  await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
  fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: end } });
  await userEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
}

function total() {
  return document.querySelector('.gamount')?.textContent;
}

async function exportedCsv() {
  let exported: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => { exported = blob; return 'blob:report'; }),
    revokeObjectURL: vi.fn(),
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await userEvent.click(screen.getByRole('button', { name: 'Exportar' }));
  expect(click).toHaveBeenCalledOnce();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(exported!);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T12:00:00-03:00'));
  context.sales = [
    sale('1', '2026-04-01T00:00:00-03:00', 100),
    sale('2', '2026-04-02', 200),
    sale('3', '2026-04-03T23:59:59.999-03:00', 300, 'TRANSFERENCIA'),
    sale('4', '2026-03-31T23:59:59-03:00', 1000),
    sale('5', '2026-04-04', 999),
    sale('6', '2026-04-02', 10_000, 'EFECTIVO', 'CANCELADA'),
    sale('7', '', 888),
  ];
  context.inventory = [product('1', '2026-04-01'), product('2', '2026-04-03T23:59:59-03:00', 'RESERVADO'), product('3', '2026-04-04'), product('4')];
  context.tradeIns = [trade('1', '2026-04-01'), trade('2', '2026-04-03T23:59:59-03:00', 'LISTO'), trade('3', '2026-04-04'), trade('4', '')];
  context.clients = [];
  context.repairOrders = [];
  context.clientCategories = [];
  context.customColumns = [];
  context.appSession = null;
  context.expenses = [];
  context.expensesLoaded = true;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Reports custom period', () => {
  it('keeps calendar selections as drafts until the period is applied', async () => {
    context.sales.push(sale('8', '2026-10-07', 42));
    render(<ReportsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: fecha de inicio' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('07/10/2026');
    expect(total()).toBe('$ 42');
    expect(screen.getByText('Facturación · últimos 30 días')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(screen.getByText('Facturación · 07/10/2026 al 07/10/2026')).toBeInTheDocument();
  });

  it('applies inclusive dates to revenue, comparison, bars, donut and detail rows', async () => {
    render(<ReportsScreen />);
    await applyRange();
    expect(total()).toBe('$ 600');
    expect(screen.getByText('Facturación · 01/04/2026 al 03/04/2026')).toBeInTheDocument();
    expect(screen.getByText('▼ 40% vs período anterior')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '01/04/2026: $ 100' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '02/04/2026: $ 200' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '03/04/2026: $ 300' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Efectivo: 50%' })).toBeInTheDocument();
    expect(document.querySelector('.gtip')).not.toHaveTextContent('en curso');
    expect(document.querySelectorAll('.gtk')).toHaveLength(4);
    expect(screen.getByText('02/04/2026 · V-0002')).toBeInTheDocument();
    expect(screen.getByText('Venta 6').closest('.gtk')).toHaveClass('is-void');
    for (const id of ['4', '5', '7']) expect(screen.queryByText(`Venta ${id}`)).not.toBeInTheDocument();
  });

  it('keeps unapplied drafts and invalid submissions from changing the applied report', async () => {
    context.sales.push(sale('8', '2026-10-07', 42));
    render(<ReportsScreen />);
    expect(total()).toBe('$ 42');
    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-04-01' } });
    expect(total()).toBe('$ 42');
    await applyRange();
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-04-04' } });
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior');
    expect(screen.getByLabelText('Fecha de inicio')).toHaveAttribute('aria-invalid', 'true');
    expect(total()).toBe('$ 600');
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Seleccioná');
    expect(total()).toBe('$ 600');
    await applyRange('2026-04-02', '2026-04-02');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(total()).toBe('$ 200');
  });

  it('retains the applied range across tabs and counts only dated stock entries and trade-ins', async () => {
    render(<ReportsScreen />);
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(total()).toBe('2');
    expect(screen.getByText('Estado actual')).toBeInTheDocument();
    expect(screen.getByText(/1 equipo sin fecha de ingreso no se incluye/)).toBeInTheDocument();
    expect(document.querySelectorAll('.gtk')).toHaveLength(2);
    expect(screen.queryByText('Equipo 3 128 GB')).not.toBeInTheDocument();
    expect(screen.queryByText('Equipo 4 128 GB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disponible: 1' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Canjes' }));
    expect(total()).toBe('2');
    expect(screen.getByText('1 en curso')).toBeInTheDocument();
    expect(document.querySelectorAll('.gtk')).toHaveLength(2);
    expect(screen.queryByText('Canje 3')).not.toBeInTheDocument();
    expect(screen.queryByText('Canje 4')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '03/04/2026: 1' })).toBeInTheDocument();
  });

  it('exports precisely the visible sales with date and payment filters', async () => {
    render(<ReportsScreen />);
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: 'Transferencia: 50%' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    const csv = await exportedCsv();
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('Venta 3');
    expect(csv).not.toMatch(/Venta [124567]/);
  });

  it.each([
    ['Stock', 'Reservado: 1', 'Equipo 2'],
    ['Canjes', 'Completado: 1', 'C-0002'],
  ])('exports the same filtered %s records as its list', async (tab, category, detail) => {
    render(<ReportsScreen />);
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: tab }));
    await userEvent.click(screen.getByRole('button', { name: category }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    const csv = await exportedCsv();
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain(detail);
  });

  it('returns to a preset immediately and preserves custom input for reuse', async () => {
    context.sales.push(sale('8', '2026-10-07', 42));
    render(<ReportsScreen />);
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(total()).toBe('$ 42');
    expect(screen.queryByLabelText('Fecha de inicio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue('01/04/2026');
  });

  it('keeps the bar count and donut stroke when a chart is clicked', async () => {
    render(<ReportsScreen />);
    await applyRange();
    expect(document.querySelectorAll('.gcol')).toHaveLength(3);
    expect(document.querySelector('.gcol.sel')).toHaveAttribute('aria-label', '03/04/2026: $ 300');
    await userEvent.click(screen.getByRole('button', { name: '01/04/2026: $ 100' }));
    expect(document.querySelectorAll('.gcol')).toHaveLength(3);
    expect(document.querySelector('.gcol.sel')).toHaveAttribute('aria-label', '01/04/2026: $ 100');
    const tip = document.querySelector('.gtip');
    expect(tip).toHaveTextContent('$ 100');
    expect(tip).toHaveTextContent('01/04/2026');
    expect(tip).not.toHaveAttribute('style');
    expect(document.querySelectorAll('.gtk')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Porción Transferencia' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    expect(screen.getByText('Venta 3')).toBeInTheDocument();
    expect(document.querySelector('.gdonut .gc')).toHaveTextContent('Transferencia');
    const slices = document.querySelectorAll('.gdonut path, .gdonut circle:not([stroke-dasharray])');
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) expect(slice).toHaveAttribute('stroke-width', '20');
    expect(document.querySelectorAll('.gcol')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Porción Transferencia' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(4);
  });

  it('keeps the custom range inline on a wide screen', async () => {
    render(<ReportsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    expect(screen.getByLabelText('Fecha de inicio')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Período personalizado' })).not.toBeInTheDocument();
    expect(document.querySelector('.gnow')).not.toBeInTheDocument();
  });

  it('shows an empty report and exports only a header when the range contains no records', async () => {
    render(<ReportsScreen />);
    await applyRange('2020-01-01', '2020-01-01');
    expect(total()).toBe('$ 0');
    expect(screen.getByText('No hay ventas para este período y filtro.')).toBeInTheDocument();
    expect(document.querySelectorAll('.gcol')).toHaveLength(1);
    expect(await exportedCsv()).toBe('"detalle","importe","Moneda","estado"');
  });
});

describe('Reports on a phone', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
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
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('opens the custom period as a sheet and keeps the payment legend under the total', async () => {
    render(<ReportsScreen />);
    expect(document.querySelector('.gnow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    const sheet = screen.getByRole('dialog', { name: 'Período personalizado' });
    expect(sheet.querySelector('.sheet-grab')).toBeInTheDocument();
    expect(sheet.querySelector('.sheet-foot')).toContainElement(screen.getByRole('button', { name: 'Aplicar período' }));
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-04-04' } });
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-04-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no puede ser posterior');
    expect(sheet).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Fecha de fin'), { target: { value: '2026-04-03' } });
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    expect(screen.queryByRole('dialog', { name: 'Período personalizado' })).not.toBeInTheDocument();
    expect(total()).toBe('$ 600');
    expect(screen.getByText('Facturación · 01/04/2026 al 03/04/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personalizado' })).toHaveAttribute('aria-pressed', 'true');
    const cash = screen.getByRole('button', { name: 'Efectivo: 50%' });
    expect(cash).toHaveTextContent('$ 300');
    expect(cash).toHaveTextContent('50%');
    expect(document.querySelector('.gnow')).toHaveTextContent('03/04/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Semana' }));
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Personalizado' })).toHaveAttribute('aria-pressed', 'false');
  });
});

const client = (id: string, name: string, createdAt: string | null, tag = ''): Client => ({
  id, name, dni: id, email: '', phone: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0, createdAt, tag,
});

const repair = (id: string, status: string, receivedAt: string, estimate: number | null, extras: Partial<RepairOrder> = {}): RepairOrder => ({
  id,
  orderNumber: Number(id),
  code: `OT-${id.padStart(4, '0')}`,
  clientId: 'c1',
  clientName: `Cliente ${id}`,
  clientPhone: '',
  device: `Equipo ${id}`,
  imei: '',
  fault: 'Pantalla',
  faultTags: ['Pantalla'],
  estimate,
  deposit: 0,
  technician: extras.technician ?? 'Ana',
  status,
  estimatedDelivery: null,
  notifyWhatsapp: false,
  receivedAt,
  whatsappUrl: null,
  events: extras.events ?? [{ id: `${id}-e`, status, createdAt: receivedAt }],
  ...extras,
});

describe('Reports breakdown and new sections', () => {
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
  });

  it('breaks sales down by model, condition, color and seller', async () => {
    context.sales[0] = { ...context.sales[0], productId: '1', customFields: { vendedor: 'Ana' } };
    context.sales[1] = { ...context.sales[1], productId: '2' };
    context.sales[2] = { ...context.sales[2], deviceLabel: 'iPhone 13' };
    context.inventory[0] = { ...context.inventory[0], model: 'Pixel 8', color: 'Negro', condition: 'NUEVO' };
    context.inventory[1] = { ...context.inventory[1], model: 'Pixel 8', color: 'Blanco', condition: 'USADO' };
    render(<ReportsScreen />);
    await applyRange();
    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Modelo' }));
    expect(screen.getByRole('heading', { name: 'Por modelo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pixel 8: 50%' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(2);
    expect(screen.getByText('Venta 1')).toBeInTheDocument();
    expect(screen.getByText('Venta 2')).toBeInTheDocument();
    expect(screen.queryByText('Venta 3')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Condición' }));
    expect(screen.getByRole('button', { name: 'Nuevo: 17%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usado: 33%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin dato: 50%' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Color' }));
    expect(screen.getByRole('button', { name: 'Negro: 17%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blanco: 33%' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Vendedor' }));
    expect(screen.getByRole('heading', { name: 'Por vendedor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ana: 17%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin vendedor: 83%' })).toBeInTheDocument();
    expect(document.querySelectorAll('.gtk')).toHaveLength(4);
  });

  it('breaks stock and trade-ins down by the chosen column', async () => {
    context.inventory[1] = { ...context.inventory[1], color: 'Blanco' };
    render(<ReportsScreen />);
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: 'Stock' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Color' }));
    expect(screen.getByRole('heading', { name: 'Por color' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Negro: 1' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Canjes' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Equipo recibido' }));
    expect(screen.getByRole('heading', { name: 'Por equipo recibido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Canje 1: 1' })).toBeInTheDocument();
  });

  it('reports new clients, returning clients and top buyers in the store currency', async () => {
    context.clients = [
      client('c1', 'Ana Pérez', '2026-04-02T12:00:00-03:00', 'VIP'),
      client('c2', 'Luis Gómez', '2026-01-15T12:00:00-03:00'),
    ];
    context.sales = [
      { ...sale('1', '2026-04-01', 100_000), clientId: 'c2', clientName: 'Luis Gómez', amountCurrency: 'ARS' },
      { ...sale('2', '2026-04-02', 250_000), clientId: 'c2', clientName: 'Luis Gómez', amountCurrency: 'ARS' },
      { ...sale('3', '2026-04-03', 400_000), clientId: 'c1', clientName: 'Ana Pérez', amountCurrency: 'ARS' },
      { ...sale('4', '2025-12-01', 90_000), clientId: 'c2', clientName: 'Luis Gómez', amountCurrency: 'ARS' },
    ];
    render(
      <ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}>
        <ReportsScreen />
      </ExchangeProvider>,
    );
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: 'Clientes' }));
    expect(total()).toBe('1');
    expect(screen.getByText('1 recurrente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por tipo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alta: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recurrente: 1' })).toBeInTheDocument();
    expect(screen.getByText('Top por compras')).toBeInTheDocument();
    expect(screen.getByText('US$ 350')).toBeInTheDocument();
    expect(screen.getByText('US$ 400')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Alta: 1' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Etiqueta' }));
    expect(screen.getByRole('button', { name: 'VIP: 1' })).toBeInTheDocument();
  });

  it('reports repair orders by status, turnaround and billed amount', async () => {
    context.repairOrders = [
      repair('1', 'RECIBIDO', '01/04/2026', 1000, { currency: 'USD', technician: 'Ana' }),
      repair('2', 'ENTREGADO', '01/04/2026', 500, {
        currency: 'USD',
        technician: 'Luis',
        events: [{ id: 'e2', status: 'ENTREGADO', createdAt: '03/04/2026' }],
      }),
    ];
    render(
      <ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1000, manualSell: 1000 }}>
        <ReportsScreen />
      </ExchangeProvider>,
    );
    await applyRange();
    await userEvent.click(screen.getByRole('button', { name: 'Servicio' }));
    expect(screen.getByText(/Facturación ·/)).toBeInTheDocument();
    expect(total()).toBe('US$ 1.500');
    expect(screen.getByText(/2 órdenes · tiempo medio: 2 días/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por estado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recibido: 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregado: 1' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Columna de desglose' }));
    await userEvent.click(screen.getByRole('option', { name: 'Técnico' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ana: 1' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.queryByText('Cliente 2')).not.toBeInTheDocument();
  });

  it('hides client and service reports when those sections are not allowed', async () => {
    context.appSession = { membership: { role: 'MANAGER', sections: ['reports', 'sales', 'inventory', 'tradeins'] } };
    render(<ReportsScreen />);
    expect(screen.queryByRole('button', { name: 'Clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Servicio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ventas' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Columna de desglose' })).toBeInTheDocument();
    expect(screen.queryByTestId('net-profit')).not.toBeInTheDocument();
  });

  it('resta los gastos del período en la ganancia neta del dueño', async () => {
    context.appSession = { membership: { role: 'OWNER' } };
    context.expensesLoaded = true;
    context.inventory[0] = { ...context.inventory[0], cost: 40 };
    context.sales[1] = { ...context.sales[1], productId: '1' };
    context.expenses = [{ id: 'g1', date: '2026-04-02', category: 'Alquiler', amount: 50, currency: 'ARS', exchangeRate: null, notes: null, deletedAt: null }];
    render(<ReportsScreen />);
    await applyRange();
    const card = screen.getByTestId('net-profit');
    expect(card).toHaveTextContent('Ganancia bruta');
    expect(card).toHaveTextContent('$ 560');
    expect(card).toHaveTextContent('$ 50');
    expect(card).toHaveTextContent('$ 510');
  });

  it('espera con un esqueleto y no muestra una ganancia vacía', () => {
    context.appSession = { membership: { role: 'OWNER' } };
    context.expensesLoaded = false;
    context.expenses = [];
    render(<ReportsScreen />);
    expect(screen.getByTestId('net-profit-loading')).toBeInTheDocument();
    expect(screen.queryByText('Ganancia neta')).not.toBeInTheDocument();
  });
});

describe('reports without module access', () => {
  afterEach(() => { context.appSession = null; });
  it('shows a calm empty state for reports-only members', () => {
    context.appSession = { membership: { role: 'STAFF', sections: ['reports'] } };
    render(<ReportsScreen />);
    expect(screen.getByText('No hay secciones habilitadas para tus reportes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument();
  });
  it('shows only reports for the granted modules', () => {
    context.appSession = { membership: { role: 'STAFF', sections: ['reports', 'service'] } };
    render(<ReportsScreen />);
    expect(screen.getByRole('button', { name: 'Servicio' })).toBeInTheDocument();
    for (const label of ['Ventas', 'Stock', 'Canjes', 'Clientes']) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
  });
});
