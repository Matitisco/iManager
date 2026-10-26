import { textContent } from '../../test/text-content';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CashData, CashRegister } from '../../types/cash';
import { DeskProvider } from '../ui';
import { CashScreen } from './CashScreen';

const api = vi.hoisted(() => ({ loadCash: vi.fn(), mutateCash: vi.fn(), loadCashHistory: vi.fn(), loadCashSessions: vi.fn() }));
let cashData: CashData;
let role: 'OWNER' | 'STAFF';
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ ...api, cashData, appSession: { membership: { role } } }) }));
vi.mock('../commission-blue', () => ({ useCommissionBlue: () => ({ rate: 1500, error: '' }) }));
function register(currency: 'ARS' | 'USD', balance: number): CashRegister {
  return { id: currency, name: `Caja ${currency}`, currency, balance, method: 'EFECTIVO', isDefault: true, archivedAt: null, session: { id: `session-${currency}`, day: '2026-10-14', status: 'OPEN', reviewNote: null } };
}
function setup() {
  render(<DeskProvider value={{ tab: 'cash', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: role === 'STAFF', canManageSensitive: role === 'OWNER' }}><CashScreen /></DeskProvider>);
  return userEvent.setup();
}
beforeEach(() => {
  vi.clearAllMocks(); role = 'OWNER';
  cashData = { canViewBalances: true, registers: [register('ARS', 10000), register('USD', 100)] };
  api.loadCash.mockResolvedValue(cashData);
  api.loadCashHistory.mockResolvedValue({ movements: [], total: 0, categories: [] });
  api.loadCashSessions.mockResolvedValue({ sessions: [] });
  api.mutateCash.mockResolvedValue({});
});

describe('pantalla de caja', () => {
  it('filters using ISO calendar days, allows clearing and blocks invalid manual dates', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    await screen.findByText('No hay movimientos en este período.');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Abrir calendario: desde' }));
    await user.click(screen.getByRole('button', { name: 'lunes, 5 de octubre de 2026' }));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-22' } });
    await user.click(screen.getByRole('button', { name: 'Abrir calendario: hasta' }));
    await user.click(screen.getByRole('button', { name: 'viernes, 23 de octubre de 2026' }));
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => expect(api.loadCashHistory).toHaveBeenLastCalledWith('ARS', { from: '2026-10-05', to: '2026-10-23', offset: 0 }));
    const calls = api.loadCashHistory.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '31/02/2026' } });
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    expect(api.loadCashHistory).toHaveBeenCalledTimes(calls);
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá una fecha válida.');
    for (const label of ['desde', 'hasta']) {
      await user.click(screen.getByRole('button', { name: `Abrir calendario: ${label}` }));
      await user.click(screen.getByRole('button', { name: 'Borrar' }));
    }
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => expect(api.loadCashHistory).toHaveBeenLastCalledWith('ARS', { from: '', to: '', offset: 0 }));
  });

  it('presenta los saldos originales y abre un conteo sin mostrar saldo ni esperado', async () => {
    const user = setup();
    expect(screen.getByText('ARS 10.000,00')).toBeVisible(); expect(screen.getByText('USD 100,00')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Caja USD/ }));
    await user.click(screen.getByRole('button', { name: 'Contar y cerrar' }));
    expect(screen.getByText('USD 100,00')).not.toBeVisible();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Esperado', { exact: true })).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Cantidad de 100', { exact: true }), '2');
    await user.type(within(dialog).getByLabelText('Cantidad de 0.1', { exact: true }), '3');
    expect(within(dialog).getByText(textContent('Total contado: USD 200,30'))).toBeVisible();
    await user.type(within(dialog).getByLabelText('Nota', { exact: true }), 'Revisado');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar conteo' }));
    expect(api.mutateCash).toHaveBeenCalledWith({ path: '/sessions/session-USD/count', method: 'POST', body: { denominations: { '100': 2, '0.1': 3 }, note: 'Revisado' } });
  });

  it('conserva formulario y valores cuando falla la persistencia', async () => {
    api.mutateCash.mockRejectedValue(new Error('La caja está cerrada'));
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    await user.click(screen.getByRole('button', { name: 'Ingreso' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Monto · ARS'), '1000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La caja está cerrada');
    expect(within(dialog).getByLabelText('Monto · ARS')).toHaveValue(1000);
    expect(dialog).toBeVisible();
  });

  it('no consulta historial ni ofrece administración al empleado sin saldo', async () => {
    role = 'STAFF'; cashData.canViewBalances = false;
    cashData.registers.forEach(row => { delete row.balance; });
    const user = setup();
    expect(screen.getAllByText('Saldo protegido')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Caja USD/ }));
    expect(api.loadCashHistory).not.toHaveBeenCalled(); expect(api.loadCashSessions).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Administrar caja' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingreso' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Contar y cerrar' })).toBeVisible();
  });
});

it('keeps archived registers red in Todos and preserves the active and archived tabs', async () => {
  cashData.registers[1].archivedAt = '2026-10-22';
  const user = setup();
  expect(screen.getByRole('button', { name: /Caja USD/ })).toHaveClass('is-void');
  await user.click(screen.getByRole('button', { name: 'Activas' }));
  expect(screen.queryByRole('button', { name: /Caja USD/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Archivadas' }));
  expect(screen.getByRole('button', { name: /Caja USD/ })).toHaveClass('is-void');
  expect(screen.queryByRole('button', { name: /Caja ARS/ })).not.toBeInTheDocument();
});

it('marks voided movements red and sends the selected reason when cancelling another movement', async () => {
  const movement = { id: 'old', createdAt: '2026-10-22T12:00:00Z', kind: 'INGRESO', amount: 10, voidedAt: '2026-10-22', category: 'Otros' };
  api.loadCashHistory.mockResolvedValue({ movements: [movement, { ...movement, id: 'active', voidedAt: null }], total: 2, categories: [] });
  const user = setup();
  await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
  expect((await screen.findByText('Ingreso · Anulado')).closest('.cash-movement')).toHaveClass('is-void');
  await user.click(screen.getByRole('button', { name: 'Anular Ingreso' }));
  const modal = screen.getByRole('dialog', { name: 'Anular movimiento' });
  await user.click(within(modal).getByRole('button', { name: 'Duplicado' }));
  await user.click(within(modal).getByRole('button', { name: 'Anular movimiento' }));
  expect(api.mutateCash).toHaveBeenCalledWith({ path: '/movements/active/void', method: 'POST', body: { reason: 'Duplicado' } });
});
