import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { DeskProvider } from '../ui';
import userEvent from '@testing-library/user-event';
import { clearDashboardCache } from '../dashboard-cache';
import { fetchReportsOverview } from '../../services/reports-api';
import { DashboardScreen } from './DashboardScreen';

const context = vi.hoisted(() => ({
  appSession: { user: { displayName: 'Matias' }, store: { id: 'store-1', currency: 'ARS', onboardingStartedAt: '2026-10-01' }, membership: { role: 'OWNER', sections: null as string[] | null } },
  backendStatus: 'ready', user: { uid: 'user-1' }, sales: [], inventory: [] as Product[], tradeIns: [], clients: [],
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/invitations-api', () => ({ listInvitations: vi.fn(async () => []) }));
vi.mock('../../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));
vi.mock('../../services/reports-api', () => ({ fetchReportsOverview: vi.fn(async () => ({ summary: { revenue: 0, grossProfit: 0, marginRate: 0, unitsSold: 0 }, comparison: { available: true, revenueChange: null, grossProfitChange: null, unitsChange: null }, salesSeries: [], paymentMethods: [] })) }));
function renderDashboard() {
  return render(<DeskProvider value={{ tab: 'dashboard', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><DashboardScreen /></DeskProvider>);
}
beforeEach(() => {
  clearDashboardCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T12:00:00-03:00'));
  context.inventory = []; context.appSession.membership = { role: 'OWNER', sections: null };
});
afterEach(() => vi.useRealTimers());
describe('cuenta nueva', () => {
  it.each(['2026-11-01', '2026-11-07'])('selecciona siete días y conserva el vacío mensual al %s', async today => {
    vi.setSystemTime(new Date(`${today}T12:00:00-03:00`));
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByText('Todavía no hay ventas en los últimos 7 días')).toBeVisible();
    expect(fetchReportsOverview).toHaveBeenLastCalledWith(context.user, today.endsWith('01') ? '2026-10-26' : '2026-11-01', today, expect.any(AbortSignal));
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    expect(screen.getByRole('button', { name: 'Últimos 7 días' })).toHaveAttribute('aria-pressed', 'true');
    if (today.endsWith('01')) {
      await user.click(screen.getByRole('button', { name: 'Este mes' }));
      await user.click(screen.getByRole('button', { name: 'Aplicar' }));
      expect(await screen.findByText('Todavía no hay ventas este mes')).toBeVisible();
      expect(screen.getByText('Sin ventas este mes')).toBeVisible();
      expect(fetchReportsOverview).toHaveBeenLastCalledWith(context.user, today, today, expect.any(AbortSignal));
    }
  });
  it('reutiliza Dashboard con cuatro métricas y los vacíos aprobados', async () => {
    renderDashboard();
    await screen.findAllByText('$ 0');
    expect(screen.getByRole('heading', { name: '¿Qué hay para hoy?' })).toBeVisible();
    expect(document.querySelectorAll('.dstat')).toHaveLength(4);
    expect(screen.getByText('Todavía no hay ventas en los últimos 7 días')).toBeVisible();
    expect(screen.getByText('Sin ventas en los últimos 7 días')).toBeVisible();
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
