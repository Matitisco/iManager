import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commissionFixtureDetail, commissionFixturePeople, commissionFixtureRules, commissionFixtureSummary } from '../../test/commission-fixtures';
import { CommissionsScreen } from './CommissionsScreen';
import { CommissionPaymentSheet, CommissionRuleSheet } from './commission-sheets';
import { MemberPermissions } from './MemberPermissions';
import { SaleForm } from '../overlays/operation';
import type { OperationInput } from '../../services/operations-api';
const context = vi.hoisted(() => ({
  appSession: { user: { id: 'owner', displayName: 'Usuario Ejemplo' }, store: { id: 'store', timezone: 'America/Argentina/Buenos_Aires' }, membership: { role: 'OWNER', sections: null as string[] | null } },
  commissionSummaries: {} as Record<string, typeof commissionFixtureSummary>, commissionDetails: {} as Record<string, typeof commissionFixtureDetail>, commissionRules: [] as typeof commissionFixtureRules,
  commissionSellers: [{ id: 'sofia', name: 'Sofía Pérez', role: 'STAFF' }],
  loadCommissions: vi.fn(), loadCommissionDetail: vi.fn(), loadCommissionSellers: vi.fn(), payCommission: vi.fn(), saveCommissionRule: vi.fn(), deleteCommissionRule: vi.fn(), setCommissionRuleActive: vi.fn(), voidCommissionPayment: vi.fn(),
  sales: [], inventory: [{ id: 'product', model: 'iPhone 15', capacity: '128GB', price: 1300000, currency: 'ARS', status: 'DISPONIBLE' }], clients: [], operationOptions: {} as Record<string, { products: { id: string; model: string; capacity: string; price: number; currency: string; status: string }[]; clients: never[] }>, loadOperationOptions: vi.fn(), createOperation: vi.fn(), fetchSaleOperation: vi.fn(), fetchTradeOperation: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../commission-blue', () => ({ useCommissionBlue: () => ({ rate: 1300, error: '' }) }));
vi.mock('../exchange', () => ({ useMoney: () => ({ active: 'ARS', rate: 1300, inputValue: (n: number) => String(n), show: (n: number) => `$ ${n}`, compact: (n: number) => `$ ${n}`, commitGroup: (fields: { typed: number }[]) => ({ blocked: false, amounts: fields.map(field => ({ amount: field.typed, currency: 'ARS' })) }) }) }));
vi.mock('../ui', async () => ({ ...await vi.importActual<typeof import('../ui')>('../ui'), useDesk: () => ({ back: vi.fn(), go: vi.fn(), close: vi.fn() }) }));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-13T15:00:00Z'));
  context.appSession.membership = { role: 'OWNER', sections: null };
  context.commissionSummaries = { '2026-10': commissionFixtureSummary };
  context.commissionDetails = { 'sofia:2026-10': commissionFixtureDetail, 'mine:2026-10': commissionFixtureDetail, 'lucia:2026-10': { period: commissionFixtureDetail.period, person: commissionFixturePeople[2] } };
  context.commissionRules = structuredClone(commissionFixtureRules);
  context.operationOptions = {};
  for (const fn of [context.loadCommissions, context.loadCommissionDetail, context.loadCommissionSellers, context.payCommission, context.saveCommissionRule, context.deleteCommissionRule, context.setCommissionRuleActive, context.voidCommissionPayment, context.loadOperationOptions, context.createOperation]) fn.mockReset().mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('Comisiones', () => {
  describe.each([false, true])('payment recipient selector (phone: %s)', phone => {
    let matchMedia: typeof window.matchMedia;
    beforeEach(() => {
      matchMedia = window.matchMedia;
      window.matchMedia = vi.fn(query => ({ matches: phone && query.includes('max-width'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    });
    afterEach(() => { window.matchMedia = matchMedia; });

    it('opens recipients outside the payment modal and updates settlement after selection', async () => {
      render(<div className="desk-app"><CommissionsScreen /></div>);
      await waitFor(() => expect(screen.queryByText('Cargando comisiones…')).not.toBeInTheDocument());
      await userEvent.click(screen.getAllByRole('button', { name: 'Registrar pago' })[0]);
      const payment = screen.getByRole('dialog', { name: 'Registrar pago' });
      const recipient = within(payment).getByRole('combobox', { name: 'Para' });
      fireEvent.change(within(payment).getByLabelText('Monto del pago'), { target: { value: '13000' } });
      await userEvent.click(recipient);
      expect(recipient).toHaveAttribute('aria-expanded', 'true');
      const list = screen.getByRole('listbox', { name: 'Para' });
      expect(payment).not.toContainElement(list);
      expect(list.closest('.ds-select-layer, .ds-select-backdrop')?.parentElement).toHaveClass('desk-app');
      expect(within(list).getAllByRole('option')).toHaveLength(3);
      expect(within(list).getByRole('option', { name: /Sofía Pérez/ })).toHaveAttribute('aria-selected', 'true');
      const deduction = within(list).getByRole('option', { name: /Lucía Díaz/ });
      expect(deduction).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(deduction);
      expect(screen.getByRole('listbox', { name: 'Para' })).toBeInTheDocument();
      await userEvent.click(within(list).getByRole('option', { name: /Martín Gómez/ }));
      expect(recipient).toHaveTextContent('Martín Gómez');
      expect(screen.queryByRole('listbox', { name: 'Para' })).not.toBeInTheDocument();
      expect(recipient).toHaveFocus();
      expect(within(payment).getByText(/Equivale a/)).toHaveTextContent('Equivale a US$ 10');
      expect(within(payment).getByText(/Queda pendiente:/)).toHaveTextContent('Queda pendiente: US$ 30');
      expect(context.payCommission).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'no sellers', people: [] },
      { name: 'only settled balances and deductions', people: commissionFixtureSummary.people.map(person => ({ ...person, pending: { ARS: Math.min(0, person.pending.ARS), USD: 0 } })) },
    ])('explains the empty state with $name', async ({ people }) => {
      render(<CommissionPaymentSheet memberId={null} period="2026-10" people={people} onClose={vi.fn()} />);
      expect(screen.getByRole('status')).toHaveTextContent('No hay comisiones pendientes');
      const recipient = screen.getByRole('combobox', { name: 'Para' });
      expect(recipient).toBeDisabled();
      await userEvent.click(recipient);
      expect(screen.queryByRole('listbox', { name: 'Para' })).not.toBeInTheDocument();
      expect(context.payCommission).not.toHaveBeenCalled();
    });
  });

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
  it.each(['Eliminar', 'Desactivar', 'Activar'])('confirms %s on a saved rule and preserves the sheet when dismissed', async action => {
    if (action === 'Activar') context.commissionRules[0].active = false;
    const onClose = vi.fn();
    render(<CommissionRuleSheet memberId={null} period="2026-10" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: `${action} regla de Todo el equipo` }));
    const confirmation = screen.getByRole('dialog', { name: `${action} regla` });
    expect(confirmation).toHaveTextContent('comisiones ya registradas se conservan');
    expect(context.deleteCommissionRule).not.toHaveBeenCalled();
    expect(context.setCommissionRuleActive).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: `${action} regla` })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `${action} regla de Todo el equipo` }));
    await userEvent.click(within(screen.getByRole('dialog', { name: `${action} regla` })).getByRole('button', { name: `${action} regla` }));
    if (action === 'Eliminar') expect(context.deleteCommissionRule).toHaveBeenCalledWith('team-rule');
    else expect(context.setCommissionRuleActive).toHaveBeenCalledWith('team-rule', action === 'Activar');
  });
  it('keeps rule confirmation open on a persistence error', async () => {
    context.deleteCommissionRule.mockRejectedValueOnce(new Error('No se pudo eliminar'));
    render(<CommissionRuleSheet memberId={null} period="2026-10" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar regla de Todo el equipo' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Eliminar regla' })).getByRole('button', { name: 'Eliminar regla' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Eliminar regla' })).toHaveTextContent('No se pudo eliminar'));
  });
  it('confirms voiding a payment, retains detail on Escape and surfaces failures', async () => {
    render(<CommissionsScreen />);
    await waitFor(() => expect(screen.queryByText('Cargando comisiones…')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Sofía Pérez/ }));
    await userEvent.click(screen.getAllByRole('button', { name: /Anular pago de/ })[0]);
    expect(context.voidCommissionPayment).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Anular pago' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /^Sofía Pérez/ })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Anular pago de/ })[0]);
    context.voidCommissionPayment.mockRejectedValueOnce(new Error('Pago no anulado'));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Anular pago' })).getByRole('button', { name: 'Anular pago' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Anular pago' })).toHaveTextContent('Pago no anulado'));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Anular pago' })).getByRole('button', { name: 'Anular pago' }));
    expect(context.voidCommissionPayment).toHaveBeenLastCalledWith('payment-sofia-1', 'sofia', '2026-10');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Anular pago' })).not.toBeInTheDocument());
  });
  it('uses Propietario in commission permission explanations', () => {
    render(<MemberPermissions member={{ id: 'sofia', userId: 'sofia-user', role: 'STAFF', sections: null, isDefault: true, createdAt: '2026-01-01', user: { id: 'sofia-user', displayName: 'Sofía', email: 'sofia@test.com', avatarUrl: null } }} onBack={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/Por defecto lo tiene solo el Propietario/)).toBeInTheDocument();
    expect(screen.queryByText(/Dueño/)).not.toBeInTheDocument();
  });
  it('pluralizes a single sale in the detail and adds the desktop Rules icon', async () => {
    context.commissionDetails['sofia:2026-10'] = { ...commissionFixtureDetail, person: { ...commissionFixtureDetail.person, salesCount: 1 } };
    render(<CommissionsScreen />);
    await waitFor(() => expect(screen.queryByText('Cargando comisiones…')).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: 'Reglas' }).some(button => button.querySelector('svg'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /Sofía Pérez/ }));
    expect(screen.getByText('1 venta', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('1 ventas', { exact: true })).not.toBeInTheDocument();
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
  it('finds and selects a device without Estado from backend sale options', async () => {
    context.operationOptions = { sales: { products: [{ ...context.inventory[0], status: '' }], clients: [] } };
    render(<SaleForm run={vi.fn()} busy={false} error={null} />);
    await userEvent.type(screen.getByRole('combobox', { name: 'Equipo' }), 'iPhone');
    await userEvent.click(await screen.findByRole('option', { name: /iPhone 15/ }));
    expect(screen.getByRole('combobox', { name: 'Equipo' })).toHaveValue('iPhone 15 · 128GB');
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
