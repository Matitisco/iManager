import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionSeller } from '../types/commissions';
import type { Sale } from '../types';
import { beneficiaryInput, beneficiaryKey } from '../types/commissions';
import { AssignSellerSheet } from './AssignSellerSheet';
import { SellerField } from './SellerField';
import { sellerFilterOptions, salesMatchingSellers } from './sale-sellers';
import { effectiveRule } from './commissions';
import { CommissionPaymentSheet, CommissionRuleSheet } from './screens/commission-sheets';
import { commissionFixturePeople } from '../test/commission-fixtures';
import { SalesScreen } from './screens/SalesScreen';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  appSession: { membership: { role: 'OWNER', sections: null as string[] | null }, store: { id: 'store' } },
  commissionSellers: [] as CommissionSeller[], saveReseller: vi.fn(), loadCommissionSellers: vi.fn(async () => {}),
  assignCommissionSeller: vi.fn(async () => {}), reloadSales: vi.fn(async () => {}),
  commissionRules: [], payCommission: vi.fn(), saveCommissionRule: vi.fn(), loadCommissions: vi.fn(async () => {}),
  sales: [] as Sale[], clients: [], inventory: [], returns: [],
}));
vi.mock('./commission-blue', () => ({ useCommissionBlue: () => ({ rate: 1300, error: '' }) }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../config/featureFlags', () => ({ IMPORT_SALES_ENABLED: false }));
const reseller = { id: 'reseller:diego', resellerId: 'diego', name: 'Diego Ejemplo', role: 'RESELLER' as const };
const sale = (id: string, extra: Partial<Sale> = {}): Sale => ({ id, date: '2026-10-13', productId: '', clientId: '', clientName: `Cliente ${id}`, deviceLabel: 'Equipo ficticio', amount: 100, paymentMethod: 'EFECTIVO', status: 'COMPLETADA', ...extra });
beforeEach(() => {
  vi.clearAllMocks();
  ctx.appSession.membership = { role: 'OWNER', sections: null };
  ctx.commissionSellers = [{ id: 'owner', name: 'Dueño Ejemplo', role: 'OWNER' }, reseller];
  ctx.payCommission.mockResolvedValue({}); ctx.saveCommissionRule.mockResolvedValue({});
  ctx.saveReseller.mockResolvedValue({ id: 'nuevo', name: 'Nuevo Ejemplo', archivedAt: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('usa claves de UI sin confundirlas con membresías', () => {
  expect(beneficiaryKey({ memberId: null, resellerId: 'diego' })).toBe(reseller.id);
  expect(beneficiaryInput(reseller.id)).toEqual({ memberId: null, resellerId: 'diego' });
  const rows = [sale('a', { resellerId: 'diego' }), sale('b'), sale('c', { sellerMemberId: 'owner' })];
  expect(sellerFilterOptions(rows, ctx.commissionSellers)).toEqual(expect.arrayContaining([expect.objectContaining({ id: reseller.id, role: 'RESELLER', count: 1 })]));
  expect(salesMatchingSellers(rows, [reseller.id]).map(row => row.id)).toEqual(['a']);
  expect(salesMatchingSellers(rows, ['none']).map(row => row.id)).toEqual(['b']);
});

it('resuelve reglas de revendedor sin aplicarlas al equipo', () => {
  const team = { id: 'team', storeId: 'store', memberId: null, rate: 10, effectiveFrom: '2026-01-01', basis: 'SALE_PERCENT' as const, currency: null, createdAt: '2026-01-01', createdBy: 'owner' };
  const personal = { ...team, id: 'personal', resellerId: 'diego', rate: 20 };
  expect(effectiveRule([personal, team], reseller.id, '2026-10')?.rate).toBe(20);
  expect(effectiveRule([personal, team], 'owner', '2026-10')?.rate).toBe(10);
});

describe.each([390, 1440])('selector y lista de revendedores a %i', width => {
  beforeEach(() => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ media: query, matches: width === 390 && query.includes('max-width'), onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
  });
  it('muestra el grupo, el avatar amarillo y permite elegir sin invitar', async () => {
    const change = vi.fn(); render(<SellerField value="" onChange={change} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    expect(screen.getByText('Revendedores', { exact: true })).toBeVisible();
    const option = screen.getByRole('option', { name: 'Diego Ejemplo' });
    expect(option.querySelector('.av-c')).toHaveStyle({ background: '#FFD000' });
    await userEvent.click(option);
    expect(change).toHaveBeenCalledWith('reseller:diego');
  });
  it('alta rápida espera persistencia y muestra errores sin cerrar', async () => {
    const change = vi.fn(); render(<SellerField value="" onChange={change} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await userEvent.click(screen.getByRole('option', { name: '+ Agregar revendedor' }));
    await userEvent.type(screen.getByLabelText('Nombre del revendedor'), 'Nuevo Ejemplo');
    ctx.saveReseller.mockRejectedValueOnce(new Error('Nombre duplicado'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar revendedor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nombre duplicado');
    expect(change).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar revendedor' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith('reseller:nuevo'));
    expect(ctx.saveReseller).toHaveBeenLastCalledWith({ name: 'Nuevo Ejemplo' }, undefined);
  });
  it('Ver todas permite renombrar y archivar con confirmación, conservando historial', async () => {
    render(<SellerField value="" onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
    await userEvent.click(screen.getByRole('option', { name: 'Ver todas' }));
    await userEvent.click(screen.getByRole('button', { name: /^Archivar$/ }));
    expect(ctx.saveReseller).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Archivar revendedor' }));
    await waitFor(() => expect(ctx.saveReseller).toHaveBeenCalledWith({ archived: true }, 'diego'));
  });
  it('lista y filtro muestran Revendedor y Sin vendedor conserva su identidad', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 18, 12));
    ctx.sales = [sale('externo', { resellerId: 'diego' }), sale('libre')];
    render(<DeskProvider value={{ tab: 'sales', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><SalesScreen /></DeskProvider>);
    const row = screen.getByText('Cliente externo').closest(width === 390 ? '.sale-card' : 'tr') as HTMLElement;
    expect(row).toHaveTextContent('Diego Ejemplo'); expect(row).toHaveTextContent('Revendedor');
    expect(row.querySelector('.av-c')).toHaveStyle({ background: '#FFD000' });
    if (width === 1440) expect(screen.getByText('Cliente libre').closest('tr')).toHaveTextContent('Sin vendedor');
    expect(within(row).queryByText('Dueño Ejemplo')).not.toBeInTheDocument();
    await userEvent.click(width === 390 ? screen.getByTestId('sales-seller-chip') : screen.getByRole('button', { name: 'Filtrar vendedor' }));
    const filter = width === 390 ? within(screen.getByRole('dialog', { name: 'Vendedor' })) : screen;
    expect(filter.getByRole('checkbox', { name: /Diego Ejemplo/ }).closest('label')?.querySelector('.av-c')).toHaveStyle({ background: '#FFD000' });
    await userEvent.click(filter.getByRole('checkbox', { name: /Diego Ejemplo/ }));
    if (width === 390) await userEvent.click(filter.getByRole('button', { name: 'Ver 1 venta' }));
    expect(screen.queryByText('Cliente libre')).not.toBeInTheDocument();
  });
});

it('no ofrece archivados al asignar ni permite alta sin Ventas', async () => {
  ctx.appSession.membership = { role: 'MANAGER', sections: ['clients'] };
  ctx.commissionSellers.push({ ...reseller, id: 'reseller:archivado', resellerId: 'archivado', name: 'Archivado Ejemplo', archivedAt: '2026-10-01' });
  render(<SellerField value="" onChange={vi.fn()} />);
  await userEvent.click(screen.getByRole('combobox', { name: 'Vendedor' }));
  expect(screen.queryByRole('option', { name: 'Archivado Ejemplo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '+ Agregar revendedor' })).not.toBeInTheDocument();
});

it('liquida a un revendedor enviando su FK real, sin membresía', async () => {
  const person = { ...commissionFixturePeople[0], memberId: null, resellerId: 'diego', role: 'RESELLER' as const, name: reseller.name };
  const close = vi.fn();
  render(<CommissionPaymentSheet memberId={reseller.id} period="2026-10" people={[person]} onClose={close} />);
  expect(screen.getByRole('combobox', { name: 'Para' })).toHaveTextContent('Revendedor');
  await userEvent.type(screen.getByLabelText('Monto del pago'), '40');
  await userEvent.click(screen.getByRole('button', { name: /^Registrar pago$/ }));
  await waitFor(() => expect(ctx.payCommission).toHaveBeenCalledWith(expect.objectContaining({ memberId: null, resellerId: 'diego', amount: 40 })));
  expect(close).toHaveBeenCalled();
});
it('guarda reglas personales para el revendedor', async () => {
  render(<CommissionRuleSheet memberId={reseller.id} period="2026-10" onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
  await waitFor(() => expect(ctx.saveCommissionRule).toHaveBeenCalledWith(expect.objectContaining({ memberId: null, resellerId: 'diego' })));
});

it('asignación masiva agrupa revendedores y ofrece alta rápida', async () => {
  render(<AssignSellerSheet saleIds={['sale']} subtitle="Una venta" onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByText('Revendedores', { exact: true })).toBeVisible();
  expect(screen.getByRole('button', { name: '+ Agregar revendedor' })).toBeVisible();
  await userEvent.click(screen.getByRole('radio', { name: /Diego Ejemplo/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Asignar a Diego' }));
  await waitFor(() => expect(ctx.assignCommissionSeller).toHaveBeenCalledWith(['sale'], reseller.id));
});
