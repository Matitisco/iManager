import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, Sale, TradeIn } from '../../types';
import { ReportsScreen } from './ReportsScreen';

const context = vi.hoisted(() => ({ sales: [] as Sale[], inventory: [] as Product[], tradeIns: [] as TradeIn[], clients: [] as Client[] }));
const desk = vi.hoisted(() => ({ open: vi.fn(), toast: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../ui', () => ({ useDesk: () => desk, Pill: ({ status }: { status: string }) => <span>{status}</span> }));

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
    expect(document.querySelectorAll('.gtk')).toHaveLength(3);
    expect(screen.getByText('02/04/2026 · V-0002')).toBeInTheDocument();
    for (const id of ['4', '5', '6', '7']) expect(screen.queryByText(`Venta ${id}`)).not.toBeInTheDocument();
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
    expect(document.querySelectorAll('.gtk')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Porción Transferencia' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(1);
    expect(screen.getByText('Venta 3')).toBeInTheDocument();
    expect(document.querySelector('.gdonut .gc')).toHaveTextContent('Transferencia');
    const slices = document.querySelectorAll('.gdonut path, .gdonut circle:not([stroke-dasharray])');
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) expect(slice).toHaveAttribute('stroke-width', '20');
    expect(document.querySelectorAll('.gcol')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Porción Transferencia' }));
    expect(document.querySelectorAll('.gtk')).toHaveLength(3);
  });

  it('shows an empty report and exports only a header when the range contains no records', async () => {
    render(<ReportsScreen />);
    await applyRange('2020-01-01', '2020-01-01');
    expect(total()).toBe('$ 0');
    expect(screen.getByText('No hay ventas para este período y filtro.')).toBeInTheDocument();
    expect(document.querySelectorAll('.gcol')).toHaveLength(1);
    expect(await exportedCsv()).toBe('"detalle","importe","estado"');
  });
});
