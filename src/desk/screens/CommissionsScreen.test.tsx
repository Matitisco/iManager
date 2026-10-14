import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commissionFixtureDetail, commissionFixturePeople, commissionFixtureRules, commissionFixtureSummary } from '../../test/commission-fixtures';
import { CommissionsScreen } from './CommissionsScreen';
import { CommissionPaymentSheet, CommissionRuleSheet } from './commission-sheets';
import { SaleForm } from '../overlays/operation';
import type { OperationInput } from '../../services/operations-api';
const context = vi.hoisted(() => ({
  appSession: { user: { id: 'owner', displayName: 'Usuario Ejemplo' }, store: { id: 'store', timezone: 'America/Argentina/Buenos_Aires' }, membership: { role: 'OWNER', sections: null as string[] | null } },
  commissionSummaries: {} as Record<string, typeof commissionFixtureSummary>, commissionDetails: {} as Record<string, typeof commissionFixtureDetail>, commissionRules: [] as typeof commissionFixtureRules,
  commissionSellers: [{ id: 'sofia', name: 'Sofía Pérez', role: 'STAFF' }],
  loadCommissions: vi.fn(), loadCommissionDetail: vi.fn(), loadCommissionSellers: vi.fn(), payCommission: vi.fn(), saveCommissionRule: vi.fn(),
  sales: [], inventory: [{ id: 'product', model: 'iPhone 15', capacity: '128GB', price: 1300000, currency: 'ARS', status: 'DISPONIBLE' }], clients: [], operationOptions: {}, loadOperationOptions: vi.fn(), createOperation: vi.fn(), fetchSaleOperation: vi.fn(), fetchTradeOperation: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../commission-blue', () => ({ useCommissionBlue: () => ({ rate: 1300, error: '' }) }));
vi.mock('../exchange', () => ({ useMoney: () => ({ active: 'ARS', rate: 1300, inputValue: (n: number) => String(n), show: (n: number) => `$ ${n}`, commitGroup: (fields: { typed: number }[]) => ({ blocked: false, amounts: fields.map(field => ({ amount: field.typed, currency: 'ARS' })) }) }) }));
vi.mock('../ui', async () => ({ ...await vi.importActual<typeof import('../ui')>('../ui'), useDesk: () => ({ back: vi.fn(), go: vi.fn(), close: vi.fn() }) }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-13T15:00:00Z'));
  context.appSession.membership = { role: 'OWNER', sections: null };
  context.commissionSummaries = { '2026-10': commissionFixtureSummary };
  context.commissionDetails = { 'sofia:2026-10': commissionFixtureDetail, 'mine:2026-10': commissionFixtureDetail, 'lucia:2026-10': { period: commissionFixtureDetail.period, person: commissionFixturePeople[2] } };
  context.commissionRules = commissionFixtureRules;
  for (const fn of [context.loadCommissions, context.loadCommissionDetail, context.loadCommissionSellers, context.payCommission, context.saveCommissionRule, context.loadOperationOptions, context.createOperation]) fn.mockReset().mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('Comisiones', () => {
  it('keeps payable balances separate from deductions and has no export action', async () => {
    render(<CommissionsScreen />);
    await waitFor(() => expect(screen.queryByText('Cargando comisiones…')).not.toBeInTheDocument());
    expect(document.querySelector('.commission-kpis')?.textContent).toContain('$ 112.000');
    expect(document.querySelector('.commission-kpis')?.textContent).toContain('US$ 80');
    expect(screen.getByText(/Lucía Díaz: a descontar/)).toHaveTextContent('$ 46.000 en noviembre de 2026');
    expect(screen.queryByRole('button', { name: /exportar|descargar|copiar|csv/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Lucía Díaz/ }));
    expect(screen.getByText('Ajuste por venta anulada')).toBeInTheDocument();
    expect(screen.getByText(/Se le pagó de más/)).toHaveTextContent('$ 46.000');
  });
  it('shows only own sales without profit or administrative controls', async () => {
    context.appSession.membership = { role: 'STAFF', sections: ['sales', 'reports'] };
    render(<CommissionsScreen />);
    await screen.findByText('Tu regla: 10 % sobre ganancia.');
    expect(screen.getByRole('heading', { name: 'Mis comisiones' })).toBeInTheDocument();
    expect(document.querySelector('.commission-ledger')?.textContent).toContain('Venta $ 1.300.000');
    expect(document.querySelector('.commission-ledger')?.textContent).not.toMatch(/ganancia|costo/i);
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
    expect(context.loadCommissionDetail).not.toHaveBeenCalled();
    expect(document.querySelector('s')).toHaveTextContent('$ 30.000');
  });
  it('hides per-sale profit from a commissions administrator without Reports', async () => {
    context.appSession.membership = { role: 'MANAGER', sections: ['commissions'] };
    render(<CommissionsScreen />);
    await waitFor(() => expect(screen.queryByText('Cargando comisiones…')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Sofía Pérez/ }));
    expect(document.querySelector('.commission-ledger')?.textContent).not.toMatch(/ganancia|costo/i);
  });
  it('previews cross-currency settlement and preserves errors in the payment sheet', async () => {
    context.payCommission.mockRejectedValueOnce(new Error('No se pudo persistir el pago'));
    render(<CommissionPaymentSheet memberId="sofia" period="2026-10" people={commissionFixtureSummary.people} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Monto del pago'), { target: { value: '50' } });
    expect(screen.getByLabelText('Cotización del pago')).toHaveValue(1300);
    expect(screen.getByText(/Queda pendiente:/)).toHaveTextContent('$ 47.000 + US$ 40');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(context.payCommission).toHaveBeenCalledWith(expect.objectContaining({ amount: 50, currency: 'USD', settlesCurrency: 'ARS', exchangeRate: 1300 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo persistir');
    expect(screen.getByRole('dialog', { name: 'Registrar pago' })).toBeInTheDocument();
  });
  it('saves a personal fixed rule with its currency and effective date', async () => {
    render(<CommissionRuleSheet memberId="sofia" period="2026-10" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Monto fijo por equipo' }));
    await userEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Monto por equipo'), { target: { value: '20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
    expect(context.saveCommissionRule).toHaveBeenCalledWith({ memberId: 'sofia', basis: 'FIXED_PER_UNIT', rate: 20, currency: 'USD', effectiveFrom: '2026-10-01' });
  });
});
describe('Vendedor en nueva venta', () => {
  it('starts empty and allows a sale without seller, preserving the exchange rate', async () => {
    const run = vi.fn(async (action: () => Promise<unknown>) => { await action(); });
    render(<SaleForm preset={{ productId: 'product' }} run={run} busy={false} error={null} />);
    const seller = screen.getByRole('combobox', { name: 'Vendedor' });
    expect(seller).toHaveTextContent('Sin vendedor');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(context.createOperation).toHaveBeenCalled());
    const input = context.createOperation.mock.calls[0][1] as OperationInput;
    expect(input).toMatchObject({ sellerMemberId: null, exchangeRate: 1300 });
  });
  it('uses a seller only after manual selection', async () => {
    const run = vi.fn(async (action: () => Promise<unknown>) => { await action(); });
    render(<SaleForm preset={{ productId: 'product' }} run={run} busy={false} error={null} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await userEvent.click(screen.getByRole('option', { name: 'Sofía Pérez · Empleado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
    await waitFor(() => expect(context.createOperation).toHaveBeenCalledWith('sales', expect.objectContaining({ sellerMemberId: 'sofia' })));
  });
});
