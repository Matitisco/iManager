import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { DeskProvider } from '../ui';
import { DashboardScreen } from './DashboardScreen';

const context = vi.hoisted(() => ({
  appSession: { user: { displayName: 'Matias' }, store: { id: 'store-1', currency: 'ARS', onboardingStartedAt: '2026-10-01' }, membership: { role: 'OWNER', sections: null as string[] | null } },
  backendStatus: 'ready', user: { uid: 'user-1' }, sales: [], inventory: [] as Product[], tradeIns: [], clients: [],
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));
vi.mock('../../services/reports-api', () => ({ fetchReportsOverview: vi.fn(async () => ({ summary: { revenue: 0, grossProfit: 0, marginRate: 0, unitsSold: 0 }, comparison: { available: true, revenueChange: null, grossProfitChange: null, unitsChange: null }, salesSeries: [], paymentMethods: [] })) }));
function renderDashboard() {
  return render(<DeskProvider value={{ tab: 'dashboard', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><DashboardScreen /></DeskProvider>);
}
beforeEach(() => { context.inventory = []; context.appSession.membership = { role: 'OWNER', sections: null }; });
describe('cuenta nueva', () => {
  it('reutiliza Dashboard con cuatro métricas y los vacíos aprobados', async () => {
    renderDashboard();
    await screen.findAllByText('$ 0');
    expect(screen.getByRole('heading', { name: '¿Qué hay para hoy?' })).toBeVisible();
    expect(document.querySelectorAll('.dstat')).toHaveLength(4);
    expect(screen.getByText('Todavía no hay ventas este mes')).toBeVisible();
    expect(screen.getByText('Sin ventas este mes')).toBeVisible();
    expect(screen.getByText('Todavía no registraste ventas')).toBeVisible();
    expect(screen.getByRole('button', { name: /Canjes en curso/ })).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: /Saldos a cobrar/ })).toHaveTextContent('$ 0');
    expect(screen.queryByText('Flujo sugerido')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByLabelText(/Variación|Sin base de comparación/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Registrar venta' })).toHaveLength(1);
  });
  it('conserva stock disponible, total y barra sin variación', async () => {
    context.inventory = [{ id: 'available', status: 'DISPONIBLE' }, { id: 'sold', status: 'VENDIDO' }] as Product[];
    renderDashboard();
    await screen.findAllByText('$ 0');
    const stock = screen.getByRole('button', { name: /Stock disponible/ });
    expect(stock).toHaveTextContent('1 de 2');
    expect(screen.getByRole('meter', { name: 'Stock disponible' })).toHaveAttribute('aria-valuenow', '1');
    expect(within(stock).queryByLabelText(/Variación/)).toBeNull();
  });
  it.each([['OWNER', 'Propietario'], ['MANAGER', 'Socio']])('conserva el rol %s en avatares', async (role, label) => {
    context.appSession.membership.role = role;
    renderDashboard();
    await screen.findAllByText('$ 0');
    expect(screen.getByTitle(`Matias · ${label}`)).toBeVisible();
  });
});
