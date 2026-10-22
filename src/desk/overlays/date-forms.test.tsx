import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClientForm } from './client';
import { ReturnForm } from './return-case';
import { ExpenseForm } from './expense';
import { SalePaymentsFields } from './sale-payments';
import { CommissionRuleSheet } from '../screens/commission-sheets';
import { DeskProvider } from '../ui';
import type { Client, Sale } from '../../types';

const context = vi.hoisted(() => ({
  clients: [] as Client[], sales: [] as Sale[], inventory: [], expenses: [],
  addClient: vi.fn(), updateClient: vi.fn(), createReturn: vi.fn(), saveExpense: vi.fn(),
  commissionRules: [], commissionSellers: [], loadCommissionSellers: vi.fn(), saveCommissionRule: vi.fn(), loadCommissions: vi.fn(),
}));
const close = vi.fn();
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../exchange', () => ({ useMoney: () => ({ active: 'ARS', rate: 1300 }) }));

function mount(child: ReactNode) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>{child}</DeskProvider></div>);
}
const run = async (action: () => Promise<unknown>) => { await action(); };
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
async function select(label: string, day: string) {
  await userEvent.click(screen.getByRole('button', { name: `Abrir calendario: ${label.toLowerCase()}` }));
  await userEvent.click(screen.getByRole('button', { name: day }));
}

beforeEach(() => {
  vi.clearAllMocks();
  context.clients = [];
  context.sales = [{ id: 'sale', clientId: 'client', paymentMethod: 'EFECTIVO', productId: 'device', clientName: 'Cliente de prueba', deviceLabel: 'iPhone 13', date: '22/10/2026', amount: 100, amountCurrency: 'ARS', status: 'COMPLETADA' }];
  for (const fn of [context.addClient, context.createReturn, context.saveExpense, context.loadCommissionSellers, context.saveCommissionRule, context.loadCommissions]) fn.mockResolvedValue(undefined);
});

it.each([390, 1440])('saves an optional birthday as a local ISO day at %s px', async width => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width, writable: true });
  mount(<ClientForm run={run} busy={false} error={null} />);
  change('Nombre y apellido', 'Cliente de prueba');
  change('Cumpleaños', '29/02/2000');
  await select('Cumpleaños', 'martes, 29 de febrero de 2000');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
  await waitFor(() => expect(context.addClient).toHaveBeenCalledWith(expect.objectContaining({ birthday: '2000-02-29' })));
});

it('rejects impossible birthdays and still saves an explicitly cleared birthday as null', async () => {
  mount(<ClientForm run={run} busy={false} error={null} />);
  change('Nombre y apellido', 'Cliente de prueba');
  change('Cumpleaños', '29/02/2001');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
  expect(context.addClient).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Cumpleaños')).toHaveAccessibleDescription('Ingresá una fecha válida.');
  await userEvent.click(screen.getByRole('button', { name: 'Abrir calendario: cumpleaños' }));
  await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
  await waitFor(() => expect(context.addClient).toHaveBeenCalledWith(expect.objectContaining({ birthday: null })));
});

it('selects claim dates, blocks invalid/empty dates, and preserves the payload and form on failure', async () => {
  context.createReturn.mockRejectedValue(new Error('No se pudo guardar'));
  mount(<ReturnForm saleId="sale" />);
  change('Motivo', 'Falla de prueba');
  for (const invalid of ['', '31/02/2026', '12/']) {
    change('Fecha del reclamo', invalid);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir reclamo' }));
    expect(context.createReturn).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Fecha del reclamo')).toHaveAttribute('aria-invalid', 'true');
  }
  change('Fecha del reclamo', '2026-10-22');
  await select('Fecha', 'viernes, 23 de octubre de 2026');
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Abrir reclamo' }));
  await waitFor(() => expect(context.createReturn).toHaveBeenCalledWith({ saleId: 'sale', reason: 'Falla de prueba', openedOn: '2026-10-23', diagnosis: null, imei: null }));
  expect(screen.getByRole('dialog', { name: 'Nuevo reclamo' })).toBeInTheDocument();
  expect(screen.getByLabelText('Fecha del reclamo')).toHaveValue('23/10/2026');
  expect(close).not.toHaveBeenCalled();
});

it('preserves the expense ISO day and refuses impossible manually typed dates', async () => {
  mount(<ExpenseForm />);
  change('Categoría', 'Gasto de prueba'); change('Monto', '100'); change('Fecha', '31/04/2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }));
  expect(context.saveExpense).not.toHaveBeenCalled();
  change('Fecha', '2026-10-22');
  await select('Fecha', 'sábado, 24 de octubre de 2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }));
  expect(context.saveExpense).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-24' }), undefined);
});

it('keeps commission effectiveFrom in ISO format and locks its picker during persistence', async () => {
  let resolve: () => void = () => undefined;
  context.saveCommissionRule.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
  mount(<CommissionRuleSheet memberId={null} period="2026-10" onClose={close} />);
  change('Vigente desde', '31/02/2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
  expect(context.saveCommissionRule).not.toHaveBeenCalled();
  change('Vigente desde', '2026-10-01');
  await select('Vigente desde', 'lunes, 5 de octubre de 2026');
  await userEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
  expect(context.saveCommissionRule).toHaveBeenCalledWith(expect.objectContaining({ effectiveFrom: '2026-10-05' }));
  expect(screen.getByLabelText('Vigente desde')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Abrir calendario: vigente desde' })).toBeDisabled();
  resolve();
  await waitFor(() => expect(close).toHaveBeenCalled());
});

it('uses the shared picker for installment firstDueDate and rejects invalid days', async () => {
  const onChange = vi.fn();
  mount(<SalePaymentsFields clientId="client" due={300} currency="ARS" suggestedRate={1300} onChange={onChange} />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Financiar en cuotas' }));
  change('Primer vencimiento', '31/02/2026');
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, payload: null }));
  change('Primer vencimiento', '2026-11-01');
  await select('Primer vencimiento', 'lunes, 2 de noviembre de 2026');
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ error: null, payload: expect.objectContaining({ installments: expect.objectContaining({ firstDueDate: '2026-11-02' }) }) }));
});
