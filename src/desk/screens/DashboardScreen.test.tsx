import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Sale, TradeIn } from '../../types';
import type { ReportsOverview } from '../../services/reports-api';
import { ExchangeProvider } from '../exchange';
import { DeskProvider } from '../ui';
import { DashboardScreen } from './DashboardScreen';

const api = vi.hoisted(() => ({ fetchReportsOverview: vi.fn(), listMembers: vi.fn(async () => []) }));
const context = vi.hoisted(() => ({
  appSession: {
    user: { displayName: 'Luis', email: 'luis@test.com' },
    store: { id: 'store-1', name: 'Centro', currency: 'ARS' as const },
    membership: { role: 'OWNER', sections: null as string[] | null },
    onboardingRequired: false,
  },
  backendStatus: 'ready', user: { uid: 'user-1' }, listsLoaded: true,
  sales: [] as Sale[], inventory: [] as Product[], tradeIns: [] as TradeIn[], clients: [] as never[],
  operationNotifications: [] as Array<{ section: string; readAt?: string | null }>,
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => ({ listMembers: api.listMembers }));
vi.mock('../../services/reports-api', () => ({ fetchReportsOverview: api.fetchReportsOverview }));
const go = vi.fn();
const open = vi.fn();
const report: ReportsOverview = {
  summary: { revenue: 12690000, grossProfit: 3420000, marginRate: 27, unitsSold: 15 },
  comparison: { available: true, revenueChange: 18, grossProfitChange: 9, unitsChange: 25 },
  salesSeries: [1, 8, 15, 22].map((day, i) => ({ start: `2026-10-${String(day).padStart(2, '0')}`, label: '', revenue: [2600000, 3200000, 2800000, 4090000][i], unitsSold: 1 })),
  paymentMethods: [{ label: 'Efectivo', revenue: 5837400, share: 46, count: 8 }, { label: 'Transferencia', revenue: 3933900, share: 31, count: 4 }],
};
function renderScreen() {
  return render(<ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}><DeskProvider value={{ tab: 'dashboard', go, open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: context.appSession.membership.role === 'STAFF' }}><DashboardScreen /></DeskProvider></ExchangeProvider>);
}
function phoneMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes('760'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
let originalMatchMedia: typeof window.matchMedia;
beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T12:00:00-03:00'));
  context.appSession.membership = { role: 'OWNER', sections: null };
  context.appSession.store.id = 'store-1';
  context.appSession.onboardingRequired = false;
  context.backendStatus = 'ready'; context.listsLoaded = true;
  context.sales = []; context.inventory = []; context.tradeIns = []; context.clients = []; context.operationNotifications = [];
  api.fetchReportsOverview.mockReset().mockResolvedValue(structuredClone(report));
});
afterEach(() => { window.matchMedia = originalMatchMedia; vi.useRealTimers(); });

describe('Dashboard aprobado', () => {
  it('usa overview para los cuatro KPI, porcentajes y gráficos, sin el flujo anterior', async () => {
    renderScreen();
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getByRole('button', { name: /Margen bruto/ })).toHaveTextContent('$ 3,42M27%');
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('15');
    expect(screen.getByRole('button', { name: /Stock disponible/ })).toHaveTextContent('0');
    expect(screen.getAllByLabelText(/Variación.*18%/)).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Ventas del período' })).toBeVisible();
    expect(screen.getByText('Efectivo')).toBeVisible();
    expect(screen.queryByText('Flujo sugerido')).toBeNull();
    expect(document.querySelectorAll('.dashboard-kpi')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(api.fetchReportsOverview).toHaveBeenCalledWith(context.user, '2026-10-01', '2026-10-22', expect.any(AbortSignal));
    expect(api.listMembers).toHaveBeenCalledWith(context.user, 'store-1');
  });

  it('oculta las finanzas sin consultar overview cuando falta permiso', async () => {
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales', 'inventory'] };
    renderScreen();
    expect(screen.queryByRole('button', { name: /Ventas del mes|Margen bruto/ })).toBeNull();
    expect(screen.queryByText('Tendencia de ventas')).toBeNull();
    expect(screen.queryByText('Medios de pago')).toBeNull();
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toBeVisible();
    expect(screen.queryByTestId('dashboard-trades')).toBeNull();
    expect(screen.queryByRole('button', { name: /Saldos a cobrar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invitar' })).toBeNull();
    expect(api.fetchReportsOverview).not.toHaveBeenCalled();
    expect(api.listMembers).not.toHaveBeenCalled();
  });

  it('permite finanzas al empleado con Reportes habilitado', async () => {
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales', 'reports'] };
    renderScreen();
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(api.listMembers).not.toHaveBeenCalled();
  });

  it('muestra un vacío discreto si falla overview sin inventar ceros', async () => {
    api.fetchReportsOverview.mockRejectedValue(new Error('403'));
    renderScreen();
    expect(await screen.findAllByText('No se pudo consultar el período')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Ventas del mes/ })).toHaveTextContent('—');
    expect(screen.queryByText(/Reintentar|Cargando…/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('no consulta antes de resolver sesión/onboarding', () => {
    context.appSession.onboardingRequired = true;
    renderScreen();
    expect(api.fetchReportsOverview).not.toHaveBeenCalled();
  });

  it('aplica el borrador recién al confirmar y descarta respuestas del rango anterior', async () => {
    const user = userEvent.setup();
    let resolveOld!: (value: ReportsOverview) => void;
    api.fetchReportsOverview.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    renderScreen();
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    const dialog = screen.getByRole('dialog', { name: 'Elegir período' });
    await user.click(within(dialog).getByRole('button', { name: '7 días' }));
    expect(api.fetchReportsOverview).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
    await screen.findByText('$ 12,69M');
    expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, '2026-10-16', '2026-10-22', expect.any(AbortSignal));
    await act(async () => resolveOld({ ...report, summary: { ...report.summary, revenue: 999 } }));
    expect(screen.queryByText('$ 999')).toBeNull();
  });

  it('descarta respuestas al cambiar de tienda y al perder permiso', async () => {
    const resolvers: Array<(value: ReportsOverview) => void> = [];
    api.fetchReportsOverview.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
    const view = renderScreen();
    context.appSession.store.id = 'store-2';
    view.rerender(<DeskProvider value={{ tab: 'dashboard', go, open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><DashboardScreen /></DeskProvider>);
    await act(async () => resolvers[0](report));
    expect(screen.queryByText('$ 12,69M')).toBeNull();
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales'] };
    view.rerender(<DeskProvider value={{ tab: 'dashboard', go, open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: true }}><DashboardScreen /></DeskProvider>);
    await act(async () => resolvers[1](report));
    expect(screen.queryByRole('button', { name: /Ventas del mes/ })).toBeNull();
  });

  it('en celular conserva CTA, mes y ventas clicables con accesos reales', async () => {
    phoneMedia();
    const user = userEvent.setup();
    context.operationNotifications = [{ section: 'sales', readAt: null }];
    context.sales = [{ id: 'sale-1', saleNumber: 4, date: '2026-10-22', clientId: '', clientName: 'Ana Pérez', productId: '', deviceLabel: 'Pixel 8 128GB', amount: 650000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' }];
    renderScreen();
    await screen.findByText('$ 12,69M');
    expect(screen.getByRole('heading', { name: 'Ventas por semana' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Octubre 2026' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
    await user.click(within(screen.getByTestId('dashboard-register-sale')).getByRole('button', { name: 'Registrar venta' }));
    expect(open).toHaveBeenCalledWith({ type: 'new-sale' });
    const recent = screen.getByTestId('dashboard-sales');
    expect(recent).toHaveTextContent('Ana Pérez');
    expect(recent).toHaveTextContent('Pixel 8 128GB · hoy');
    expect(recent).toHaveTextContent('$ 650.000');
    await user.click(within(recent).getByRole('button', { name: /Ana Pérez/ }));
    expect(open).toHaveBeenCalledWith({ type: 'sale', id: 'sale-1' });
    await user.click(within(recent).getByRole('button', { name: 'Más acciones' }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'sale', id: 'sale-1' }));
    await user.click(screen.getByTestId('dashboard-trades'));
    expect(go).toHaveBeenCalledWith('tradeins');
    await user.click(screen.getByRole('button', { name: /Saldos a cobrar/ }));
    expect(go).toHaveBeenCalledWith('clients');
    await user.click(screen.getByTestId('dashboard-bell'));
    expect(go).toHaveBeenCalledWith('notifications');
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, '2026-09-01', '2026-09-30', expect.any(AbortSignal)));
  });
});
