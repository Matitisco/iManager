import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignSellerSheet } from './AssignSellerSheet';
import { CommissionRuleSheet } from './screens/commission-sheets';

const context = vi.hoisted(() => ({
  appSession: { store: { timezone: 'America/Argentina/Buenos_Aires' } },
  commissionSellers: [] as { id: string; name: string; role: 'STAFF' }[],
  commissionRules: [], loadCommissionSellers: vi.fn(), assignCommissionSeller: vi.fn(),
  reloadSales: vi.fn(), saveCommissionRule: vi.fn(), loadCommissions: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
beforeEach(() => { for (const fn of [context.loadCommissionSellers, context.assignCommissionSeller, context.reloadSales, context.saveCommissionRule, context.loadCommissions]) fn.mockReset(); context.commissionSellers = []; });
afterEach(() => vi.restoreAllMocks());

const sheets = [
  { name: 'asignación', render: (close: () => void) => <AssignSellerSheet saleIds={['sale']} subtitle="Una venta" onClose={close} onSaved={close} /> },
  { name: 'regla personal', render: (close: () => void) => <CommissionRuleSheet memberId="seller" period="2026-10" onClose={close} /> },
];
describe.each(sheets)('$name', sheet => {
  it('shows a neutral seller empty state and logs load failures', async () => {
    const cause = new Error('No se pudieron cargar los vendedores');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    context.loadCommissionSellers.mockRejectedValue(cause);
    render(sheet.render(vi.fn()));
    expect(await screen.findByText('Sin vendedores para mostrar.')).toBeVisible();
    expect(warn).toHaveBeenCalledWith('No se pudieron cargar los vendedores.', cause);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
  });

  it('keeps save failures visible even when the directory request fails later', async () => {
    let rejectLoad!: (cause: Error) => void;
    context.loadCommissionSellers.mockReturnValue(new Promise((_, reject) => { rejectLoad = reject; }));
    context.commissionSellers = [{ id: 'seller', name: 'Ana', role: 'STAFF' }];
    const close = vi.fn();
    context.assignCommissionSeller.mockRejectedValue(new Error('No se pudo guardar la asignación'));
    context.saveCommissionRule.mockRejectedValue(new Error('No se pudo guardar la regla'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(sheet.render(close));
    if (sheet.name === 'asignación') await userEvent.click(screen.getByRole('radio', { name: /Ana/ }));
    await userEvent.click(screen.getByRole('button', { name: /^(Asignar a Ana|Guardar regla)$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    rejectLoad(new Error('No se pudieron cargar los vendedores'));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});
