import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, Sale, TradeIn } from '../../types';
import type { ReportsOverview } from '../../services/reports-api';
import { NETWORK_ERROR_MESSAGE } from '../../lib/user-message';
import { ExchangeProvider } from '../exchange';
import { DeskProvider } from '../ui';
import { DashboardScreen } from './DashboardScreen';
import { clearDashboardCache, readLatestDashboardCache } from '../dashboard-cache';

const api = vi.hoisted(() => ({ fetchReportsOverview: vi.fn(), listMembers: vi.fn(), listInvitations: vi.fn() }));
const context = vi.hoisted(() => ({
  appSession: {
    user: { displayName: 'Luis', email: 'luis@test.com' },
    store: { id: 'store-1', name: 'Centro', currency: 'ARS' as const },
    membership: { role: 'OWNER', sections: null as string[] | null },
    onboardingRequired: false,
  },
  backendStatus: 'ready', sessionConfirmed: true, listsSettled: true, listsLoadFailed: false, user: { uid: 'user-1' }, listsLoaded: true, gettingStartedLoaded: true, gettingStarted: null as { eligible: boolean } | null,
  sales: [] as Sale[], inventory: [] as Product[], tradeIns: [] as TradeIn[], clients: [] as Client[],
  operationNotifications: [] as Array<{ section: string; readAt?: string | null }>,
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => ({ listMembers: api.listMembers }));
vi.mock('../../services/invitations-api', () => ({ listInvitations: api.listInvitations }));
vi.mock('../../services/reports-api', () => ({ fetchReportsOverview: api.fetchReportsOverview }));
const go = vi.fn();
const open = vi.fn();
const report: ReportsOverview = {
  summary: { revenue: 12690000, grossProfit: 3420000, marginRate: 27, unitsSold: 15 },
  comparison: { available: true, revenueChange: 18, grossProfitChange: 9, unitsChange: 25 },
  salesSeries: [1, 8, 15, 22].map((day, i) => ({ start: `2026-10-${String(day).padStart(2, '0')}`, label: '', revenue: [2600000, 3200000, 2800000, 4090000][i], unitsSold: 1 })),
  paymentMethods: [{ label: 'Efectivo', revenue: 5837400, share: 46, count: 8 }, { label: 'Transferencia', revenue: 3933900, share: 31, count: 4 }],
};
function dashboardView() {
  return (<ExchangeProvider settings={{ currency: 'ARS', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1500, manualSell: 1555 }}><DeskProvider value={{ tab: 'dashboard', go, open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: context.appSession.membership.role === 'STAFF' }}><DashboardScreen /></DeskProvider></ExchangeProvider>);
}
function renderScreen() {
  return render(dashboardView());
}
function makeSale(id: string, date: string, clientName: string): Sale {
  return { id, date, clientName, clientId: '', productId: '', deviceLabel: 'Pixel 8', amount: 1000, amountCurrency: 'ARS', paymentMethod: 'EFECTIVO', status: 'COMPLETADA' };
}
function phoneMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes('760'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function expectNoSkeleton() {
  expect(screen.queryByTestId('dashboard-initial-loading')).toBeNull();
  expect(screen.queryByTestId('dashboard-sales-loading')).toBeNull();
  expect(document.querySelector('.dashboard-screen .skeleton, .dashboard-screen [aria-busy="true"]')).toBeNull();
}
let originalMatchMedia: typeof window.matchMedia;
beforeEach(() => {
  clearDashboardCache();
  context.user.uid = 'user-1';
  originalMatchMedia = window.matchMedia;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-22T12:00:00-03:00'));
  context.appSession.membership = { role: 'OWNER', sections: null };
  context.appSession.store.id = 'store-1';
  context.appSession.onboardingRequired = false;
  context.backendStatus = 'ready'; context.sessionConfirmed = true; context.listsLoaded = true; context.listsSettled = true; context.listsLoadFailed = false; context.gettingStartedLoaded = true; context.gettingStarted = null;
  context.sales = []; context.inventory = []; context.tradeIns = []; context.clients = []; context.operationNotifications = [];
  api.fetchReportsOverview.mockReset().mockResolvedValue(structuredClone(report));
  api.listInvitations.mockReset().mockResolvedValue([]);
  api.listMembers.mockReset().mockResolvedValue([]);
});
afterEach(() => { window.matchMedia = originalMatchMedia; vi.useRealTimers(); });

describe('Dashboard aprobado', () => {
  it.each([false, true])('muestra la nota de ventas sin costo solo cuando hay exclusiones (móvil=%s)', async phone => {
    if (phone) phoneMedia();
    api.fetchReportsOverview.mockResolvedValueOnce({ ...report, summary: { ...report.summary, salesWithoutCost: 2 } });
    const view = renderScreen();
    const note = await screen.findByText('2 ventas sin costo no incluidas');
    expect(note.closest('.dstat')).toHaveTextContent('Margen bruto');
    expect(note.closest('.dstat')).toHaveTextContent('27%');
    api.fetchReportsOverview.mockResolvedValueOnce({ ...report, summary: { ...report.summary, salesWithoutCost: 0 } });
    context.sales = [makeSale('refresh', '2026-10-22', 'Nueva')];
    view.rerender(dashboardView());
    await waitFor(() => expect(screen.queryByText('2 ventas sin costo no incluidas')).not.toBeInTheDocument());
  });

  it.each([new Error('500'), new TypeError('Failed to fetch')])('avisa si falla un cambio de período y reintenta las mismas fechas: %s', async cause => {
    const user = userEvent.setup();
    context.sales = [makeSale('old', '2026-10-02', 'Venta anterior')];
    renderScreen();
    await screen.findByText('$ 12,69M');
    api.fetchReportsOverview.mockRejectedValueOnce(cause);
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Se muestran datos del período anterior.');
    expect(screen.getByText('Venta anterior')).toBeVisible();
    expect(screen.getByText('$ 12,69M')).toBeVisible();
    expectNoSkeleton();
    api.fetchReportsOverview.mockResolvedValueOnce({ ...report, summary: { ...report.summary, revenue: 1000 } });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 1.000'));
    expect(api.fetchReportsOverview.mock.calls.at(-1)!.slice(1, 3)).toEqual(['2026-10-22', '2026-10-22']);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Venta anterior')).toBeNull();
  });

  it('ignora el error de un período reemplazado por otra consulta exitosa', async () => {
    const user = userEvent.setup();
    renderScreen(); await screen.findByText('$ 12,69M');
    const old = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(old.promise);
    for (const preset of ['Hoy', 'Total']) {
      await user.click(screen.getByRole('button', { name: /Elegir período/ }));
      await user.click(screen.getByRole('button', { name: preset }));
      await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    }
    await act(async () => old.reject(new Error('500')));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Elegir período, Total' })).toBeVisible();
  });

  it.each(['7 días', 'Total'])('mantiene la instantánea completa al elegir %s hasta el reemplazo atómico', async preset => {
    const user = userEvent.setup();
    context.sales = [makeSale('today', '2026-10-22', 'Actual'), makeSale('early', '2026-10-02', 'Anterior'), makeSale('old', '2020-01-01', 'Histórica')];
    renderScreen();
    await screen.findByText('$ 12,69M');
    const oldLabel = screen.getByRole('button', { name: /Elegir período/ }).getAttribute('aria-label');
    const next = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(next.promise);
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: preset }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('button', { name: /Elegir período/ })).not.toHaveAttribute('aria-label', oldLabel);
    if (preset === 'Total') expect(screen.getByRole('button', { name: 'Elegir período, Total' })).toBeVisible();
    expect(screen.getByText('$ 12,69M')).toBeVisible();
    expect(screen.getByText('Anterior')).toBeVisible();
    expect(screen.queryByText('Histórica')).toBeNull();
    expect(screen.getByText('Efectivo')).toBeVisible();
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('15');
    expectNoSkeleton();
    await act(async () => next.resolve({ ...report, summary: { ...report.summary, revenue: 1000, unitsSold: 42 }, paymentMethods: [{ label: 'Tarjeta', revenue: 1000, share: 100, count: 42 }] }));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 1.000');
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('42');
    expect(screen.getByText('Tarjeta')).toBeVisible();
    expect(screen.queryByText('Efectivo')).toBeNull();
    if (preset === 'Total') {
      expect(screen.getByText('Histórica')).toBeVisible();
      expect(screen.queryByLabelText(/Variación/)).toBeNull();
    } else expect(screen.queryByText('Anterior')).toBeNull();
    expectNoSkeleton();
  });

  it('revalida cambios reales de ventas y stock sin vaciar, y conserva el resultado si falla', async () => {
    context.sales = [makeSale('old', '2026-10-22', 'Inicial')];
    const view = renderScreen();
    await screen.findByText('$ 12,69M');
    const next = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(next.promise);
    context.sales = [makeSale('new', '2026-10-22', 'Nueva'), ...context.sales];
    view.rerender(dashboardView());
    expect(screen.getByText('$ 12,69M')).toBeVisible();
    expect(screen.queryByText('Nueva')).toBeNull();
    expectNoSkeleton();
    const salesSignal = api.fetchReportsOverview.mock.calls.at(-1)![3] as AbortSignal;
    const stock = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(stock.promise);
    context.inventory = [{ id: 'p', status: 'DISPONIBLE' }] as Product[];
    view.rerender(dashboardView());
    expect(salesSignal.aborted).toBe(true);
    expect(screen.getByRole('button', { name: /Stock disponible/ })).toHaveTextContent('1 de 1');
    expectNoSkeleton();
    await act(async () => stock.resolve({ ...report, summary: { ...report.summary, revenue: 2000 } }));
    expect(screen.getByText('Nueva')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 2.000');
    await act(async () => next.resolve(report));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 2.000');
    const failed = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(failed.promise);
    context.sales = [makeSale('failed', '2026-10-22', 'Sin resolver'), ...context.sales];
    view.rerender(dashboardView());
    await act(async () => failed.reject(new Error('403')));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 2.000');
    expect(screen.queryByText('Sin resolver')).toBeNull();
    expect(screen.queryByText('No se pudo consultar el período')).toBeNull();
    expectNoSkeleton();
    context.backendStatus = 'offline';
    view.rerender(dashboardView());
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 2.000');
    expectNoSkeleton();
  });

  it('aborta un rango lento y descarta su resultado después de resolver el más reciente', async () => {
    const user = userEvent.setup();
    renderScreen(); await screen.findByText('$ 12,69M');
    const old = deferred<ReportsOverview>();
    const latest = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    for (const preset of ['7 días', 'Total']) {
      await user.click(screen.getByRole('button', { name: /Elegir período/ }));
      await user.click(screen.getByRole('button', { name: preset }));
      await user.click(screen.getByRole('button', { name: 'Aplicar' }));
      expectNoSkeleton();
    }
    expect((api.fetchReportsOverview.mock.calls[1][3] as AbortSignal).aborted).toBe(true);
    await act(async () => latest.resolve({ ...report, summary: { ...report.summary, revenue: 2000 } }));
    await act(async () => old.resolve({ ...report, summary: { ...report.summary, revenue: 999 } }));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 2.000');
    expect(screen.getByRole('button', { name: 'Elegir período, Total' })).toBeVisible();
    expectNoSkeleton();
  });

  it.each(['7 días', 'Total'])('remonta en el mes actual cacheado después de elegir %s, sin skeleton mientras revalida', async preset => {
    const user = userEvent.setup();
    api.listMembers.mockResolvedValue([{ role: 'MANAGER', user: { displayName: 'Ana Gómez', email: 'ana@test.com' } }]);
    const view = renderScreen(); await screen.findByText('$ 12,69M');
    const monthLabel = screen.getByRole('button', { name: /Elegir período/ }).getAttribute('aria-label')!;
    api.fetchReportsOverview.mockResolvedValueOnce({ ...report, summary: { ...report.summary, revenue: 2000 } });
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: preset }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 2.000'));
    view.unmount();
    const next = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(next.promise);
    api.listMembers.mockReturnValueOnce(new Promise(() => {}));
    renderScreen();
    expect(screen.getByText('$ 12,69M')).toBeVisible();
    expect(screen.getByTitle(/Ana Gómez/)).toBeVisible();
    expect(screen.getByRole('button', { name: monthLabel })).toBeVisible();
    expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, '2026-10-01', '2026-10-22', expect.any(AbortSignal));
    expectNoSkeleton();
    await act(async () => next.resolve({ ...report, summary: { ...report.summary, revenue: 3000 } }));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 3.000');
  });

  it.each([
    ['2026-10-23', '2026-10-01'],
    ['2026-11-01', '2026-11-01'],
  ])('remonta con skeleton del reporte si la clave del mes actual no existe al llegar %s', async (today, start) => {
    api.listMembers.mockResolvedValue([{ role: 'MANAGER', user: { displayName: 'Ana Gómez' } }]);
    const view = renderScreen(); await screen.findByText('$ 12,69M');
    const scope = JSON.stringify([context.appSession.store.id, context.user.uid, context.appSession.membership.role, context.appSession.membership.sections]);
    await waitFor(() => expect(readLatestDashboardCache(scope)?.initialResolved).toBe(true));
    view.unmount();
    vi.setSystemTime(new Date(`${today}T12:00:00-03:00`));
    const next = deferred<ReportsOverview>();
    api.fetchReportsOverview.mockReturnValueOnce(next.promise);
    api.listMembers.mockReturnValueOnce(new Promise(() => {}));
    renderScreen();
    expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, start, today, expect.any(AbortSignal));
    expect(screen.queryByText('$ 12,69M')).toBeNull();
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.dashboard-trend .skeleton, .dashboard-payments .skeleton')).toHaveLength(2);
    expect(screen.getByTestId('dashboard-sales-loading')).toBeInTheDocument();
    expect(screen.getByTitle(/Ana Gómez/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Stock disponible/ })).toHaveAttribute('aria-busy', 'false');
    expect(document.querySelector('.avatars .skeleton')).toBeNull();
    await act(async () => next.resolve({ ...report, summary: { ...report.summary, revenue: 3000 } }));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 3.000');
    expectNoSkeleton();
  });

  it.each(['uid', 'store', 'role', 'sections', 'logout'])('no reutiliza el reporte ni miembros al cambiar %s', async change => {
    api.listMembers.mockResolvedValue([{ role: 'MANAGER', user: { displayName: 'Ana Gómez' } }]);
    const view = renderScreen(); await screen.findByText('$ 12,69M');
    view.unmount();
    if (change === 'uid') context.user.uid = 'user-2';
    if (change === 'store') context.appSession.store.id = 'store-2';
    if (change === 'role') context.appSession.membership.role = 'MANAGER';
    if (change === 'sections') context.appSession.membership.sections = ['dashboard', 'reports', 'sales'];
    if (change === 'logout') clearDashboardCache();
    api.fetchReportsOverview.mockReturnValueOnce(new Promise(() => {}));
    api.listMembers.mockReturnValueOnce(new Promise(() => {}));
    renderScreen();
    expect(screen.queryByText('$ 12,69M')).toBeNull();
    expect(screen.queryByTitle(/Ana Gómez/)).toBeNull();
    expect(screen.getByTestId('dashboard-sales-loading')).toBeInTheDocument();
  });

  it('usa overview para los cuatro KPI, porcentajes y gráficos, sin el flujo anterior', async () => {
    renderScreen();
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getByRole('button', { name: /Margen bruto/ })).toHaveTextContent('$ 3,42M 27%');
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('15');
    expect(screen.getByRole('button', { name: /Stock disponible/ })).toHaveTextContent('0');
    expect(screen.getAllByLabelText(/Variación.*18%/)).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Ventas del período' })).toBeVisible();
    expect(screen.getByText('Efectivo')).toBeVisible();
    expect(screen.queryByText('Flujo sugerido')).toBeNull();
    expect(document.querySelectorAll('.dstat')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Mes anterior' })).toBeNull();
    expect(api.fetchReportsOverview).toHaveBeenCalledWith(context.user, '2026-10-01', '2026-10-22', expect.any(AbortSignal));
    expect(api.listMembers).toHaveBeenCalledWith(context.user, 'store-1');
  });

  it.each([false, true])('Contanos reutiliza el bento oscuro y abre WhatsApp sin subtítulo (celular: %s)', async phone => {
    if (phone) phoneMedia();
    let resolve!: (data: ReportsOverview) => void;
    api.fetchReportsOverview.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    renderScreen();
    const contact = screen.getByRole('link', { name: /¿Encontraste un error o tenés una idea\?\s*Contanos/ });
    expect(contact).toHaveClass('commission-hero', 'v3-contact');
    expect(contact).toHaveAttribute('href', 'https://wa.me/5491141722188');
    expect(contact).toHaveAttribute('target', '_blank');
    expect(contact).toHaveAttribute('rel', 'noopener noreferrer');
    expect(contact.textContent).toBe('¿Encontraste un error o tenés una idea?Contanos');
    expect(contact.querySelectorAll('p, small, .sub')).toHaveLength(0);
    expect(contact.querySelector('.btn2.l svg path')).toHaveAttribute('fill', 'currentColor');
    expect(contact.parentElement?.lastElementChild).toBe(contact);
    if (!phone) expect(contact.previousElementSibling).toHaveTextContent('Saldos a cobrar');
    const loading = screen.getByTestId('dashboard-sales-loading');
    expect(loading.querySelectorAll(phone ? '.phone-row' : 'tbody tr')).toHaveLength(phone ? 4 : 5);
    expect(screen.queryByText(/Cargando…|Reintentar/)).toBeNull();
    await act(async () => resolve(report));
    expect(screen.getByRole('link', { name: /Contanos/ })).toBe(contact);
    expect(screen.queryByTestId('dashboard-sales-loading')).toBeNull();
  });

  it('temporalmente muestra finanzas al empleado sin permiso de Reportes', async () => {
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales', 'inventory'] };
    renderScreen();
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Ventas|Margen bruto/ })).toHaveLength(2);
    expect(screen.getByText('Tendencia de ventas')).toBeVisible();
    expect(screen.getByText('Medios de pago')).toBeVisible();
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toBeVisible();
    expect(screen.queryByTestId('dashboard-trades')).toBeNull();
    expect(screen.queryByRole('button', { name: /Saldos a cobrar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Invitar' })).toBeNull();
    expect(api.fetchReportsOverview).toHaveBeenCalled();
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
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('—');
    expect(screen.queryByText(/Reintentar|Cargando…/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([NETWORK_ERROR_MESSAGE, 'Failed to fetch'])('oculta fallos de red sin mensajes ni vacíos sustitutos: %s', async (message) => {
    api.fetchReportsOverview.mockRejectedValue(new TypeError(message));
    renderScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveAttribute('aria-busy', 'false'));
    expect(screen.queryByText(/No hay conexión|No se pudo consultar el período|Todavía no hay ventas|Sin ventas/)).toBeNull();
    expect(document.querySelector('.dashboard-chart-empty, .dashboard-payment-empty')).toBeNull();
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('—');
  });

  it('oculta los mensajes del período mientras el backend está desconectado', () => {
    context.backendStatus = 'offline';
    renderScreen();
    expect(api.fetchReportsOverview).not.toHaveBeenCalled();
    expect(screen.queryByText('No se pudo consultar el período')).toBeNull();
    expect(document.querySelector('.dashboard-chart-empty, .dashboard-payment-empty')).toBeNull();
  });

  it('conserva el período resuelto y avisa si falla el cambio a Total', async () => {
    const user = userEvent.setup();
    context.sales = [makeSale('old', '2024-01-01', 'Histórica')];
    renderScreen();
    await screen.findByText('$ 12,69M');
    let reject!: (cause: Error) => void;
    api.fetchReportsOverview.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: 'Total' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, undefined, undefined, expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('$ 12,69M')).toBeVisible();
    expect(screen.queryByText('Histórica')).toBeNull();
    expect(screen.getAllByLabelText(/Variación/)).not.toHaveLength(0);
    await act(async () => reject(new TypeError('Failed to fetch')));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 12,69M');
    expect(screen.queryByText('Histórica')).toBeNull();
    expect(screen.getByRole('button', { name: 'Elegir período, Total' })).toBeVisible();
    expect(screen.queryByText(/No hay conexión|No se pudo consultar el período|Cargando…/)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Se muestran datos del período anterior.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    expect(document.querySelector('.dashboard-chart-empty, .dashboard-payment-empty, .dtop .sub')).toBeNull();
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

  it('descarta respuestas al cambiar de tienda y de permisos del empleado', async () => {
    const resolvers: Array<(value: ReportsOverview) => void> = [];
    api.fetchReportsOverview.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
    const view = renderScreen();
    context.appSession.store.id = 'store-2';
    view.rerender(dashboardView());
    await act(async () => resolvers[0](report));
    expect(screen.queryByText('$ 12,69M')).toBeNull();
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales'] };
    view.rerender(dashboardView());
    await act(async () => resolvers[1](report));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toBeVisible();
    expect(screen.queryByText('$ 12,69M')).toBeNull();
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
    expect(recent).toHaveTextContent('Pixel 8 128GB');
    expect(within(recent).queryByRole('table')).toBeNull();
    expect(recent.querySelector('.sale-who .av-c')).toBeInTheDocument();
    expect(recent).toHaveTextContent('#V-0004 · 22/10/2026');
    expect(recent).toHaveTextContent('Efectivo');
    expect(recent).toHaveTextContent('$ 650.000');
    await user.click(within(recent).getByRole('button', { name: /Ana Pérez.*Pixel 8/ }));
    expect(open).toHaveBeenCalledWith({ type: 'sale', id: 'sale-1' });
    await user.click(within(recent).getByRole('button', { name: 'Más acciones' }));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'sale', id: 'sale-1' }));
    expect(screen.queryByTestId('dashboard-trades')).toBeNull();
    expect(screen.queryByRole('button', { name: /Saldos a cobrar/ })).toBeNull();
    await user.click(screen.getByTestId('dashboard-bell'));
    expect(go).toHaveBeenCalledWith('notifications');
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() => expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, '2026-09-01', '2026-09-30', expect.any(AbortSignal)));
  });
  it('espera sesión, permisos, primeros pasos, las cuatro listas y overview sin cifras parciales', async () => {
    context.backendStatus = 'checking';
    context.sessionConfirmed = false;
    context.gettingStartedLoaded = false;
    context.listsLoaded = false;
    context.inventory = [{ id: 'p', status: 'DISPONIBLE' }] as Product[];
    context.tradeIns = [{ id: 't', status: 'PENDIENTE' }] as TradeIn[];
    context.clients = [{ id: 'c', pendingBalance: 12345, balanceCurrency: 'ARS' }] as Client[];
    context.sales = [makeSale('s', '2026-10-22', 'Cliente listo')];
    let resolve!: (data: ReportsOverview) => void;
    api.fetchReportsOverview.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = renderScreen();
    const rerender = () => view.rerender(dashboardView());
    expect(screen.getByTestId('dashboard-initial-loading')).toBeInTheDocument();
    expect(api.fetchReportsOverview).not.toHaveBeenCalled();
    context.backendStatus = 'ready'; rerender();
    expect(screen.getByTestId('dashboard-initial-loading')).toBeInTheDocument();
    context.sessionConfirmed = true; rerender();
    expect(screen.getByTestId('dashboard-initial-loading')).toBeInTheDocument();
    context.gettingStartedLoaded = true; rerender();
    expect(api.fetchReportsOverview).not.toHaveBeenCalled();
    const noPartial = () => {
      for (const label of [/Stock disponible/, /Canjes en curso/, /Saldos a cobrar/, /Equipos vendidos/, /^Ventas/]) {
        const card = screen.getByRole('button', { name: label });
        expect(card).toHaveAttribute('aria-busy', 'true');
        expect(card.textContent).not.toMatch(/\d/);
      }
      expect(screen.queryByText('Cliente listo')).toBeNull();
      expect(screen.queryByText('Efectivo')).toBeNull();
      expect(screen.queryByRole('meter')).toBeNull();
      expect(screen.queryByText(/Cargando…|Reintentar/)).toBeNull();
    };
    noPartial();
    context.listsLoaded = true; context.listsSettled = false; rerender();
    noPartial();
    expect(api.fetchReportsOverview).not.toHaveBeenCalled();
    context.listsSettled = true; rerender();
    noPartial();
    await act(async () => resolve(report));
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getByRole('button', { name: /Stock disponible/ })).toHaveTextContent('1 de 1');
    expect(screen.getByText('Cliente listo')).toBeVisible();
  });

  it('aplica Total de punta a punta sin fechas, variación ni ventas fuera del historial', async () => {
    const user = userEvent.setup();
    context.sales = [makeSale('current', '2026-10-22', 'Octubre'), makeSale('old', '2024-01-01', 'Histórica')];
    renderScreen();
    await screen.findByText('$ 12,69M');
    expect(screen.queryByText('Histórica')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: 'Total' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Histórica')).toBeVisible();
    expect(api.fetchReportsOverview).toHaveBeenLastCalledWith(context.user, undefined, undefined, expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: 'Elegir período, Total' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 12,69M');
    expect(screen.queryByLabelText(/Variación/)).toBeNull();
  });

  it('filtra ventas recientes por días argentinos inclusivos, ordena y conserva apertura y menú', async () => {
    const user = userEvent.setup();
    context.sales = [
      makeSale('before', '2026-10-01T02:59:59Z', 'Fuera antes'),
      makeSale('first', '2026-10-01T03:00:00Z', 'Primera'),
      makeSale('last', '2026-10-23T02:59:59Z', 'Última'),
      makeSale('after', '2026-10-23T03:00:00Z', 'Fuera después'),
      { ...makeSale('pending', '2026-10-21', 'Pendiente'), status: 'PENDIENTE' },
      { ...makeSale('void', '2026-10-20', 'Anulada'), status: 'CANCELADA' },
    ];
    renderScreen(); await screen.findByText('$ 12,69M');
    const recent = screen.getByTestId('dashboard-sales');
    const rows = Array.from(recent.querySelectorAll('tbody tr'));
    expect(rows.map(row => row.querySelector('td:nth-child(2)')?.textContent)).toEqual(['Última', 'Pendiente', 'Anulada', 'Primera']);
    expect(rows[2]).toHaveClass('is-void');
    expect(screen.queryByText(/Fuera/)).toBeNull();
    const row = within(recent).getByRole('row', { name: /Última/ });
    await user.click(row);
    expect(open).toHaveBeenCalledWith({ type: 'sale', id: 'last' });
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ type: 'ctx', kind: 'sale', id: 'last' }));
  });

  it.each([false, true])('muestra cinco ventas en tabla o cuatro phone-rows (celular: %s)', async phone => {
    if (phone) phoneMedia();
    context.sales = Array.from({ length: 7 }, (_, index) => makeSale(`s-${index}`, `2026-10-${22 - index}`, `Cliente ${index}`));
    renderScreen();
    await screen.findByText('$ 12,69M');
    const recent = screen.getByTestId('dashboard-sales');
    expect(recent.querySelectorAll(phone ? '.phone-row' : 'tbody tr')).toHaveLength(phone ? 4 : 5);
    expect(within(recent).getByRole('heading', { name: 'Ventas' })).toBeVisible();
    expect(within(recent).getByRole('button', { name: 'Ver todas' })).toBeVisible();
    if (phone) {
      expect(within(recent).queryByRole('table')).toBeNull();
      expect(recent.querySelector('.phone-rows')).toBeInTheDocument();
    } else {
      expect(within(recent).getByRole('table')).toHaveClass('dtable', 'compact');
      expect(within(recent).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Venta', 'Cliente', 'Equipo', 'Total', 'Estado']);
    }
    expect(within(recent).queryByText('Cliente 5')).toBeNull();
  });

  it('actualiza juntos ventas, margen, unidades, tendencia, medios y recientes; mantiene stock, canjes y saldos actuales', async () => {
    const user = userEvent.setup();
    context.inventory = [{ id: 'a', status: 'DISPONIBLE' }, { id: 'b', status: 'VENDIDO' }] as Product[];
    context.tradeIns = [{ id: 't', status: 'PENDIENTE', date: '2020-01-01' }, { id: 't2', status: 'CANCELADO', date: '2026-10-22' }] as TradeIn[];
    context.clients = [{ id: 'c', pendingBalance: 300, creditBalance: 50, balanceCurrency: 'ARS' }, { id: 'credit', pendingBalance: 0, creditBalance: 100, balanceCurrency: 'ARS' }] as Client[];
    context.sales = [makeSale('today', '2026-10-22', 'Hoy'), makeSale('old', '2026-10-02', 'Antes')];
    renderScreen(); await screen.findByText('$ 12,69M');
    const stock = screen.getByRole('button', { name: /Stock disponible/ });
    const trades = screen.getByTestId('dashboard-trades');
    const balances = screen.getByRole('button', { name: /Saldos a cobrar/ });
    const stable = [stock, trades, balances].map(card => card.textContent);
    expect(stable).toEqual(['Stock disponible1 de 2', 'Canjes en curso1', 'Saldos a cobrar$ 250']);
    let resolve!: (data: ReportsOverview) => void;
    api.fetchReportsOverview.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '7 días' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect([stock, trades, balances].map(card => card.textContent)).toEqual(stable);
    for (const card of [stock, trades, balances]) {
      expect(card).toHaveAttribute('aria-busy', 'false');
      expect(within(card).queryByLabelText(/Variación/)).toBeNull();
    }
    expect(screen.getByText('Antes')).toBeVisible();
    await act(async () => resolve({
      summary: { revenue: 1000, grossProfit: 250, unitsSold: 1, marginRate: 25 },
      comparison: { available: false, revenueChange: 100, grossProfitChange: 100, unitsChange: 100 },
      salesSeries: [{ label: '', start: '2026-10-22', revenue: 1000, unitsSold: 1 }],
      paymentMethods: [{ label: 'Tarjeta', revenue: 1000, count: 1, share: 100 }],
    }));
    expect(screen.getByRole('button', { name: /^Ventas/ })).toHaveTextContent('$ 1.000');
    expect(screen.getByRole('button', { name: /Margen bruto/ })).toHaveTextContent('$ 250 25%');
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('1');
    expect(screen.getByText('Tarjeta')).toBeVisible();
    expect(screen.queryByText('Efectivo')).toBeNull();
    expect(screen.queryByLabelText(/Variación/)).toBeNull();
    expect(screen.getByRole('img', { name: 'Ventas del período' }).querySelectorAll('title')[6]).toHaveTextContent('$ 1.000');
    expect(screen.getByTestId('dashboard-sales')).toHaveTextContent('Hoy');
    expect(screen.queryByText('Antes')).toBeNull();
    expect([stock, trades, balances].map(card => card.textContent)).toEqual(stable);
  });

  it('temporalmente usa el conteo financiero para el empleado en el rango y Total', async () => {
    const user = userEvent.setup();
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales', 'inventory'] };
    context.sales = [makeSale('ok', '2026-10-22', 'Actual'), makeSale('past', '2020-01-01', 'Histórica'), { ...makeSale('p', '2026-10-22', 'Pendiente'), status: 'PENDIENTE' }, { ...makeSale('v', '2026-10-22', 'Anulada'), voidedAt: '2026-10-22' }];
    renderScreen();
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('15');
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: 'Total' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getByRole('button', { name: /Equipos vendidos/ })).toHaveTextContent('15');
    expect(screen.getByText('Histórica')).toBeVisible();
    expect(api.fetchReportsOverview).toHaveBeenCalled();
  });

  it('no presenta ceros ni caché como cifras válidas si falló una lista inicial', async () => {
    context.listsLoadFailed = true;
    renderScreen();
    await screen.findByText('$ 12,69M');
    for (const name of [/Stock disponible/, /Canjes en curso/, /Saldos a cobrar/]) expect(screen.getByRole('button', { name })).toHaveTextContent('—');
    expect(screen.getByText('No se pudieron consultar las ventas')).toBeVisible();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('actualizar Primeros pasos no remonta el Dashboard ni pierde Total', async () => {
    const user = userEvent.setup();
    const view = renderScreen();
    await screen.findByText('$ 12,69M');
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: 'Total' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    await screen.findByRole('button', { name: /^Ventas/ });
    const calls = api.fetchReportsOverview.mock.calls.length;
    context.gettingStarted = { eligible: true };
    view.rerender(dashboardView());
    expect(screen.getByRole('button', { name: 'Elegir período, Total' })).toBeVisible();
    expect(api.fetchReportsOverview).toHaveBeenCalledTimes(calls);
  });

  it('temporalmente muestra finanzas al empleado y respeta los permisos de listas', async () => {
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'clients'] };
    renderScreen();
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(screen.getByText('Equipos vendidos')).toBeVisible();
    expect(screen.queryByText('Stock disponible')).toBeNull();
    expect(screen.queryByTestId('dashboard-sales')).toBeNull();
    expect(api.fetchReportsOverview).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Saldos a cobrar/ })).toBeVisible();
  });

  it('reserva el layout autorizado mientras se resuelven Primeros pasos', async () => {
    context.appSession.membership = { role: 'STAFF', sections: ['dashboard', 'sales', 'inventory'] };
    context.gettingStartedLoaded = false;
    const view = renderScreen();
    expect(document.querySelectorAll('.dstat')).toHaveLength(4);
    expect(document.querySelector('.v3-stretch')).not.toBeNull();
    context.gettingStartedLoaded = true;
    view.rerender(dashboardView());
    expect(await screen.findByText('$ 12,69M')).toBeVisible();
    expect(document.querySelectorAll('.dstat')).toHaveLength(4);
    expect(document.querySelector('.v3-stretch')).not.toBeNull();
    expect(api.fetchReportsOverview).toHaveBeenCalled();
  });

});


describe('Acceso mobile al equipo', () => {
  it.each(['OWNER', 'MANAGER'])('abre el flujo existente para %s y se oculta al crear una invitación', async role => {
    phoneMedia(); context.appSession.membership.role = role;
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Invitar al equipo' }));
    expect(open).toHaveBeenCalledWith({ type: 'invite' });
    api.listInvitations.mockResolvedValue([{ id: 'pending' }]);
    act(() => window.dispatchEvent(new Event('desk-invites')));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Invitar al equipo' })).toBeNull());
  });
  it('no ofrece invitar a empleados ni consulta equipo', async () => {
    phoneMedia(); context.appSession.membership.role = 'STAFF';
    renderScreen(); await screen.findByText('Equipos vendidos');
    expect(screen.queryByRole('button', { name: 'Invitar al equipo' })).toBeNull();
    expect(api.listInvitations).not.toHaveBeenCalled();
  });
  it('reduce el acceso al menú Más cuando el equipo ya tiene dos empleados', async () => {
    phoneMedia(); api.listMembers.mockResolvedValue(['OWNER', 'STAFF', 'STAFF'].map((role, id) => ({ id, role, user: { displayName: 'Persona' } })));
    renderScreen(); await waitFor(() => expect(api.listInvitations).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Invitar al equipo' })).toBeNull();
  });
});
