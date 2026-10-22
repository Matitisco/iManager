import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { financeDay } from '../finance-dates';
import type { CashData, CashRegister } from '../../types/cash';
import { DeskProvider } from '../ui';
import { CashScreen } from './CashScreen';

const api = vi.hoisted(() => ({ loadCash: vi.fn(), mutateCash: vi.fn(), loadCashHistory: vi.fn(), loadCashSessions: vi.fn() }));
let cashData: CashData;
let role: 'OWNER' | 'STAFF' | 'MANAGER';
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ ...api, cashData, appSession: { membership: { role } } }) }));
vi.mock('../commission-blue', () => ({ useCommissionBlue: () => ({ rate: 1500, error: '' }) }));
function register(currency: 'ARS' | 'USD', balance: number): CashRegister {
  return { id: currency, name: `Caja ${currency}`, currency, balance, method: 'EFECTIVO', isDefault: true, archivedAt: null, session: { id: `session-${currency}`, day: financeDay(), status: 'OPEN', reviewNote: null } };
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
    expect(within(dialog).getByText('Total contado: USD 200,30')).toBeVisible();
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
    cashData.registers[1].session!.opening = 7000;
    const user = setup();
    expect(screen.getAllByText('Saldo protegido')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Caja USD/ }));
    expect(api.loadCashHistory).not.toHaveBeenCalled(); expect(api.loadCashSessions).not.toHaveBeenCalled();
    expect(screen.queryByText(/Fondo de apertura/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administrar caja' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingreso' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Contar y cerrar' })).toBeVisible();
  });
  it('separa administración, informa apertura y cancelar no muta caja', async () => {
    cashData.registers[0].session = { ...cashData.registers[0].session!, openedAt: new Date().toISOString(), openedBy: 'Ana', opening: 500 };
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    expect(screen.getByText(/Abierta hoy.*por Ana/)).toBeVisible();
    expect(screen.getByText('Fondo de apertura: ARS 500,00')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Administración' })).getByRole('button', { name: /Ajustar saldo/ })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Operación diaria' })).getByRole('button', { name: 'Contar y cerrar' })).toHaveClass('p');
    await user.click(screen.getByRole('button', { name: 'Egreso' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Retira fondos de Caja ARS en ARS');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.mutateCash).not.toHaveBeenCalled();
  });

  it.each(['OWNER', 'MANAGER', 'STAFF'] as const)('solo el dueño revisa el conteo: %s', async selectedRole => {
    role = selectedRole;
    cashData.registers[0].session = { ...cashData.registers[0].session!, status: 'SUBMITTED', counts: [{ id: 'count', expected: 10000, counted: 9900, difference: -100, note: 'Revisar', denominations: null, countedBy: 'user', createdAt: new Date().toISOString() }] };
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    expect(document.querySelector('.cash-overview strong')).toHaveTextContent('ARS 10.000,00');
    expect(screen.getByText('Esperado')).toBeVisible();
    expect(Boolean(screen.queryByRole('button', { name: 'Aprobar cierre' }))).toBe(role === 'OWNER');
    expect(Boolean(screen.queryByRole('button', { name: 'Pedir reconteo' }))).toBe(role === 'OWNER');
    expect(screen.queryByRole('button', { name: 'Ingreso' })).not.toBeInTheDocument();
  });

  it('muestra la última cerrada y no ofrece reabrir el mismo día', async () => {
    cashData.registers[0].session!.status = 'APPROVED';
    const user = setup();
    expect(screen.queryByText(/Sin abrir/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    expect(screen.getByText('Cerrada', { exact: true })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Abrir día' })).not.toBeInTheDocument();
    expect(api.mutateCash).not.toHaveBeenCalled();
  });

  it('ofrece apertura después del día cerrado, y no inventa cierres sin historial', async () => {
    cashData.registers[0].session!.status = 'APPROVED';
    cashData.registers[0].session!.day = '2020-01-01';
    cashData.registers[1].session = null;
    const user = setup();
    expect(screen.getByText('Sin sesiones registradas')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    expect(screen.getByRole('button', { name: 'Abrir día' })).toBeVisible();
    expect(screen.queryByText(/Sin abrir/)).not.toBeInTheDocument();
  });

  it('presenta reconteo con motivo y mantiene el esperado oculto al contar', async () => {
    cashData.registers[0].session = { ...cashData.registers[0].session!, status: 'RECOUNT', reviewNote: 'Revisá billetes' };
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Caja ARS/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Revisá billetes');
    await user.click(screen.getByRole('button', { name: 'Recontar caja' }));
    expect(within(screen.getByRole('dialog')).queryByText('Esperado')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.mutateCash).not.toHaveBeenCalled();
  });

  it('explica el vacío sin ofrecer administración al empleado', () => {
    role = 'STAFF'; cashData.registers = [];
    setup();
    expect(screen.getByText('No hay cajas configuradas')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Crear caja' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin abrir/)).not.toBeInTheDocument();
  });

  it('presenta fallos de lectura con reintento sin generar movimientos', async () => {
    api.loadCash.mockRejectedValue(new Error('No se pudieron leer las cajas'));
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron leer las cajas');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(api.mutateCash).not.toHaveBeenCalled();
  });

});
