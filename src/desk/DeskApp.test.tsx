import type { SectionChanges, ViewSection, RecordVersion } from '../services/section-views-api';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationNotification } from '../services/operations-api';
import { NETWORK_ERROR_MESSAGE } from '../lib/user-message';
import { DeskApp } from './DeskApp';
import { MOBILE_TAB_INDICATOR_TRANSITION, clampIndicatorFrame, mobileTabIndicatorFrame, sameIndicatorFrame } from './mobile-tab-bar';

const context = vi.hoisted(() => ({
  appSession: {
    user: { displayName: 'Ana', email: 'ana@test.com' },
    store: { id: 's', name: 'Casa', ownerDisplayName: 'Matías' },
    membership: { role: 'OWNER' as 'OWNER' | 'MANAGER' | 'STAFF', sections: null as string[] | null },
    onboardingRequired: false,
  },
  user: null as { uid: string } | null,
  backendStatus: 'checking',
  sectionChanges: {} as SectionChanges,
  sectionChangesError: '',
  viewSection: undefined as undefined | ((section: ViewSection, versions: RecordVersion[]) => Promise<void>),
  publicCatalog: null,
  loadPublicCatalog: vi.fn(async () => null),
  loadCommissions: undefined as undefined | ReturnType<typeof vi.fn>,
  tradeIns: [{ id: 't1', status: 'EN REVISIÓN' }],
  inventory: [],
  sales: [],
  clients: [],
  operationNotifications: [] as OperationNotification[],
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));
vi.mock('../services/catalogs-api', () => ({ fetchCatalogs: vi.fn(async () => null), saveCatalog: vi.fn() }));

describe('sidebar unread counts', () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => {
    context.sectionChangesError = '';
    context.sectionChanges = { tradeins: [{ id: 't1', updatedAt: '2026-10-08T12:00:00.000Z' }] };
    window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  afterEach(() => {
    context.sectionChangesError = '';
    context.sectionChanges = {};
    context.viewSection = undefined;
    window.matchMedia = originalMatchMedia;
    context.appSession.membership.role = 'OWNER';
    context.appSession.membership.sections = null;
    window.location.hash = '#/dash';
    localStorage.clear();
  });

  function usePhone(reducedMotion = false) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760') || (reducedMotion && String(query).includes('prefers-reduced-motion')),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  function installTabRects() {
    const rects: Record<string, DOMRect> = {
      'mobile-tab-bar': new DOMRect(0, 780, 370, 62),
      'sidebar-tab-dashboard': new DOMRect(8, 788, 132, 46),
      'sidebar-tab-inventory': new DOMRect(148, 788, 118, 46),
      'sidebar-tab-sales': new DOMRect(220, 788, 96, 46),
      'sidebar-tab-reports': new DOMRect(268, 788, 40, 46),
      'sidebar-tab-more': new DOMRect(316, 788, 46, 46),
    };
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return rects[this.dataset.testid ?? ''] ?? new DOMRect(0, 0, 0, 0);
    });
    return () => spy.mockRestore();
  }

  function goHash(hash: string) {
    act(() => {
      window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }

  it('shows the dashboard without an alert when loading section changes fails', () => {
    context.sectionChangesError = 'No se pudieron cargar las novedades.';
    window.location.hash = '#/dashboard';
    render(<DeskApp />);
    expect(screen.getByText(/Qué hay para/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(context.sectionChangesError)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it.each([390, 1440])('hides temporary sections across navigation at %spx', async width => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    if (width === 390) usePhone();
    window.location.hash = width === 390 ? '#/mas' : '#/dashboard';
    render(<DeskApp />);
    const expectHidden = () => {
      for (const id of ['cash', 'expenses', 'followups']) {
        expect(screen.queryByTestId(`sidebar-tab-${id}`)).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('tab', { name: /Gastos|Cajas|Seguimientos|Cuenta corriente/ })).not.toBeInTheDocument();
    };
    expectHidden();
    if (width === 390) {
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('sidebar-tab-suppliers'));
    } else {
      fireEvent.click(screen.getByRole('button', { name: /Finanzas/ }));
    }
    await waitFor(() => expect(location.hash).toBe('#/finanzas/proveedores'));
    expectHidden();
    goHash('#/atencion/clientes');
    await screen.findByRole('button', { name: 'Todos' });
    expectHidden();
    expect(document.querySelector('.acct-views')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Servicio técnico' })).toBeInTheDocument();
  });

  it.each([
    ['#/finanzas/gastos', '#/dashboard'], ['#/expenses', '#/dashboard'],
    ['#/finanzas/cajas/123', '#/dashboard'], ['#cash', '#/dashboard'],
    ['#/atencion/seguimientos', '#/atencion/clientes'],
    ['#/atencion/clientes/cuenta', '#/atencion/clientes'],
    ['#/clientes?view=seguimientos', '#/atencion/clientes'],
  ])('redirects hidden deep link %s on entry and hash changes', async (hash, fallback) => {
    window.location.hash = hash;
    render(<DeskApp />);
    await waitFor(() => expect(location.hash).toBe(fallback));
    goHash('#/stock/equipos');
    await waitFor(() => expect(location.hash).toBe('#/stock/equipos'));
    goHash(hash);
    await waitFor(() => expect(location.hash).toBe(fallback));
    expect(screen.queryByText('No tenés acceso a esta sección.')).not.toBeInTheDocument();
  });

  it.each([false, true])('gates catalog menu and direct hashes for employees (granted=%s)', async granted => {
    context.appSession.membership.role = 'STAFF';
    context.appSession.membership.sections = granted ? ['publicCatalog'] : [];
    window.location.hash = '#catalogo';
    render(<DeskApp />);
    if (granted) {
      expect(screen.getByTestId('sidebar-tab-publicCatalog')).toBeInTheDocument();
      expect(await screen.findByTestId('catalog-screen')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('sidebar-tab-publicCatalog')).not.toBeInTheDocument();
      expect(screen.getByTestId('no-section-access')).toHaveTextContent('No tenés acceso');
      expect(window.location.hash).toBe('#/stock/catalogo');
    }
  });

  it.each([false, true])('places permitted employee catalog first in Más (granted=%s)', async granted => {
    usePhone();
    context.appSession.membership.role = 'STAFF';
    context.appSession.membership.sections = granted ? ['publicCatalog', 'clients'] : ['clients'];
    window.location.hash = '#/mas';
    render(<DeskApp />);
    const catalog = screen.queryByTestId('sidebar-tab-publicCatalog');
    expect(Boolean(catalog)).toBe(granted);
    expect(within(screen.getByTestId('mobile-tab-bar')).queryByText('Catálogo')).not.toBeInTheDocument();
    if (granted) {
      expect(catalog?.parentElement?.firstElementChild).toBe(catalog);
      fireEvent.click(catalog!);
      expect(await screen.findByTestId('catalog-screen')).toBeInTheDocument();
    }
  });

  it('keeps group badges in the flat sidebar and subsection badges in page tabs', async () => {
    window.location.hash = '#/dash';
    context.operationNotifications = [
      { id: '1', storeId: 's', section: 'inventory', title: 'Equipo vendido', message: 'iPhone 13 vendido', recordId: 'p', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
      { id: '2', storeId: 's', section: 'inventory', title: 'Equipo recibido', message: 'Entró un iPhone 11 por canje, en revisión', recordId: 'p2', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
      { id: '3', storeId: 's', section: 'sales', title: 'Venta registrada', message: 'iPhone 13 · Juan Pérez · $ 50.000', recordId: 's1', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
      { id: '4', storeId: 's', section: 'clients', title: 'Saldo pendiente', message: 'Juan Pérez debe $ 50.000', recordId: 'c', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: '2026-10-08T13:00:00.000Z' },
    ];
    context.sectionChanges = { inventory: [{ id: 'p', updatedAt: '2026-10-08T12:00:00.000Z' }, { id: 'p2', updatedAt: '2026-10-08T12:00:00.000Z' }], sales: [{ id: 's1', updatedAt: '2026-10-08T12:00:00.000Z' }], tradeins: [{ id: 't1', updatedAt: '2026-10-08T12:00:00.000Z' }] };
    render(<DeskApp />);
    expect(screen.getByLabelText('3 notificaciones sin leer')).toHaveTextContent('3');
    expect(screen.getByLabelText('2 avisos sin leer en Equipos')).toHaveTextContent('2');
    expect(screen.getByLabelText('1 aviso sin leer en Ventas; 1 aviso sin leer en Canjes')).toHaveTextContent('2');
    const sidebar = within(document.querySelector('aside.side')! as HTMLElement);
    expect(sidebar.queryByText('Equipos')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Canjes')).not.toBeInTheDocument();
    expect(sidebar.queryByText('Servicio técnico')).not.toBeInTheDocument();
    expect(document.querySelector('aside [aria-expanded], aside .chev, aside .sub')).toBeNull();

    fireEvent.click(sidebar.getByRole('button', { name: /Comercial/ }));
    expect(await screen.findByRole('tab', { name: 'Ventas · 1' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Canjes · 1' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Canjes · 1' })).toHaveAttribute('aria-selected', 'true'));
    expect(sidebar.getByRole('button', { name: /Comercial/ })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.getByLabelText('1 aviso sin leer en Ventas; 1 aviso sin leer en Canjes')).toHaveTextContent('2');

    fireEvent.click(sidebar.getByRole('button', { name: /Stock/ }));
    expect(await screen.findByRole('tab', { name: 'Equipos · 2' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Control de stock' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Control de stock' })).toHaveAttribute('aria-selected', 'true'));
    expect(sidebar.getByRole('button', { name: /Stock/ })).toHaveAttribute('aria-current', 'page');
    expect(sidebar.queryByText('Control de stock')).not.toBeInTheDocument();
    expect(screen.queryByText('★')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-tab-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-tab-indicator')).not.toBeInTheDocument();
  });

  it.each([390, 1440])('clears only the visited section badge, retains marks during the visit and clears them on return at %spx', async width => {
    if (width === 390) usePhone();
    window.location.hash = '#/dashboard';
    const versions = Array.from({ length: 12 }, (_, i) => ({ id: `t${i + 1}`, updatedAt: '2026-10-08T12:00:00.000Z' }));
    context.sectionChanges = { tradeins: versions, sales: [{ id: 's1', updatedAt: versions[0].updatedAt }] };
    context.viewSection = vi.fn(async (section: ViewSection) => { context.sectionChanges = { ...context.sectionChanges, [section]: [] }; });
    const view = render(<DeskApp />);
    const container = width === 390 ? screen.getByTestId('mobile-tab-bar') : document.querySelector('aside.side')! as HTMLElement;
    const badge = () => width === 390 ? within(container).getByRole('button', { name: 'Ventas' }).querySelector('.dcount') : within(container).getByLabelText(/aviso.*en Ventas/);
    expect(badge()).toHaveTextContent('13');
    if (width === 390) expect(within(container).getByRole('button', { name: 'Ventas' })).toHaveAccessibleDescription('1 aviso sin leer en Ventas; 12 avisos sin leer en Canjes');
    goHash('#/comercial/canjes');
    await waitFor(() => expect(context.viewSection).toHaveBeenCalledWith('tradeins', versions));
    view.rerender(<DeskApp />);
    expect(screen.getByRole('tab', { name: 'Canjes' })).toHaveAttribute('aria-selected', 'true');
    expect(badge()).toHaveTextContent('1');
    expect(screen.getAllByTestId('notice-dot')).toHaveLength(1);
    goHash('#/dashboard');
    goHash('#/comercial/canjes');
    await screen.findByRole('tab', { name: 'Canjes' });
    expect(screen.queryByTestId('notice-dot')).not.toBeInTheDocument();
    expect(context.viewSection).toHaveBeenCalledTimes(1);
  });

  it('lists the overflow sections on Más with commissions and without a tentative label', () => {
    usePhone();
    window.location.hash = '#/mas';
    context.operationNotifications = [
      { id: '1', storeId: 's', section: 'sales', title: 'Venta', message: 'Una venta', recordId: 's1', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
    ];
    render(<DeskApp />);
    expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();
    expect(screen.queryByText('Todas las secciones, agrupadas')).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-store-name')).toHaveTextContent('Casa');
    expect(screen.getByTestId('more-profile')).toHaveTextContent('Ana');
    expect(screen.getByTestId('more-profile')).toHaveTextContent('Propietario');
    expect(screen.getByTestId('sidebar-tab-tradeins')).toHaveTextContent('1 aviso sin leer en Canjes');
    expect(screen.getByTestId('more-item-clients')).toHaveTextContent('Agenda y saldos');
    expect(screen.getByTestId('sidebar-tab-service')).toHaveTextContent('0 abiertas');
    expect(screen.getByTestId('sidebar-tab-notifications')).toHaveTextContent('1 sin leer');
    expect(screen.getByTestId('sidebar-tab-settings')).toHaveTextContent('Configuración');
    expect(screen.getByTestId('sidebar-tab-more')).toHaveClass('on');
    expect(screen.getByTestId('sidebar-tab-reports')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-commissions')).toHaveTextContent('Comisiones');
    expect(screen.queryByText(/Tentativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/propuesta/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-header')).toHaveTextContent('iManager');
    expect(screen.getByTestId('mobile-store-name')).toHaveTextContent('Casa');
  });

  it('shows the offline banner on every section and clears it when the browser is back online', async () => {
    usePhone();
    window.location.hash = '#/dash';
    render(<DeskApp />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event('offline')); });
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
    expect(screen.getByText(/Qué hay para/)).toBeInTheDocument();
  });

  it('shows the offline banner across the phone layout when onLine flips without an event, and clears it on Clientes while onLine stays false', async () => {
    usePhone();
    const online = { value: true };
    const previousOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online.value });
    const previousFetch = globalThis.fetch;
    const testGlobal = globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string };
    testGlobal.__IMANAGER_TEST_API_BASE_URL__ = 'https://api.imanager.test';
    let releaseHealth = () => {};
    let healthGate = new Promise<void>((resolve) => { releaseHealth = resolve; });
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/health')) {
        await healthGate;
        return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return previousFetch(input, init);
    }) as typeof fetch;
    window.location.hash = '#/mas';
    try {
      render(<DeskApp />);
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();

      online.value = false;
      expect(await screen.findByTestId('offline-banner', {}, { timeout: 2500 })).toHaveTextContent(NETWORK_ERROR_MESSAGE);
      expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();

      goHash('#/inv');
      expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();

      goHash('#/clientes');
      expect(await screen.findByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

      releaseHealth();
      healthGate = Promise.resolve();
      await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument(), { timeout: 5000 });
      expect(navigator.onLine).toBe(false);
      expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();

      await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, 2200); }); });
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    } finally {
      online.value = true;
      releaseHealth();
      if (previousOnLine) Object.defineProperty(window.navigator, 'onLine', previousOnLine);
      globalThis.fetch = previousFetch;
      delete testGlobal.__IMANAGER_TEST_API_BASE_URL__;
      cleanup();
    }
  });

  it('shows the offline banner on Más and Clientes when the network fails while onLine stays true', async () => {
    usePhone();
    const previousFetch = globalThis.fetch;
    const testGlobal = globalThis as typeof globalThis & { __IMANAGER_TEST_API_BASE_URL__?: string };
    testGlobal.__IMANAGER_TEST_API_BASE_URL__ = 'https://api.imanager.test';
    let reachable = false;
    const probes: { url: string; cache: RequestCache | undefined }[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/api/health')) {
        probes.push({ url, cache: init?.cache });
        if (!reachable) throw new TypeError('Failed to fetch');
        return new Response('{"status":"ok"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return previousFetch(input, init);
    }) as typeof fetch;
    window.location.hash = '#/mas';
    try {
      render(<DeskApp />);
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(navigator.onLine).not.toBe(false);
      expect(await screen.findByTestId('offline-banner', {}, { timeout: 4000 })).toHaveTextContent(NETWORK_ERROR_MESSAGE);
      await waitFor(() => expect(probes.some((probe) => probe.url.includes('/api/health?_=') && probe.cache === 'no-store')).toBe(true), { timeout: 4000 });
      expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();

      goHash('#/clientes');
      expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

      reachable = true;
      await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument(), { timeout: 5000 });
      expect(navigator.onLine).not.toBe(false);
      expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    } finally {
      globalThis.fetch = previousFetch;
      delete testGlobal.__IMANAGER_TEST_API_BASE_URL__;
      cleanup();
    }
  });

  it('clears the offline banner on Más when the connection returns without leaving the screen', async () => {
    usePhone();
    window.location.hash = '#/mas';
    context.user = { uid: 'u' };
    context.backendStatus = 'ready';
    context.loadCommissions = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined);
    render(<DeskApp />);
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/mas');
    expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();
    context.user = null;
    context.backendStatus = 'checking';
    context.loadCommissions = undefined;
  });

  it('shows a back arrow on sections that live in Más and a dock on the bar sections', async () => {
    usePhone();
    window.location.hash = '#/servicio';
    render(<DeskApp />);
    expect(screen.getByRole('heading', { name: 'Servicio técnico' })).toBeInTheDocument();
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-clients')).toHaveClass('on');
    expect(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Nueva orden' })).toBeInTheDocument();
    expect(screen.queryByText(/Tentativo/i)).not.toBeInTheDocument();
    cleanup();

    window.location.hash = '#/inv';
    render(<DeskApp />);
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(screen.queryByTestId('page-back')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('mobile-dock')).getByRole('button', { name: 'Registrar equipo' })).toBeInTheDocument();
  });

  it('keeps a forbidden URL and shows the owner access message instead of redirecting', async () => {
    usePhone();
    context.appSession.membership.role = 'STAFF';
    context.appSession.membership.sections = ['dashboard', 'sales'];
    window.location.hash = '#/rep';
    render(<DeskApp />);
    expect(screen.getByTestId('no-section-access')).toHaveTextContent('No tenés acceso');
    expect(screen.getByText('Pedile acceso a Matías')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pedile acceso a Matías' })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/analisis/reportes');
    expect(screen.queryByTestId('sidebar-tab-reports')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al Dashboard' }));
    expect(window.location.hash).toBe('#/dashboard');
    goHash('#/inv');
    expect(screen.getByTestId('no-section-access')).toHaveTextContent('Equipos');
    expect(window.location.hash).toBe('#/stock/equipos');
  });

  it('keeps billing owner-only and shows the calm access screen', () => {
    usePhone();
    context.appSession.membership.role = 'MANAGER';
    window.location.hash = '#/plan';
    render(<DeskApp />);
    expect(screen.getByTestId('no-section-access')).toHaveTextContent('Plan y facturación');
    expect(window.location.hash).toBe('#/plan');
  });

  it('slides Canjes into the bar when an employee cannot open Reportes', () => {
    usePhone();
    window.location.hash = '#/dash';
    context.appSession.membership.role = 'STAFF';
    render(<DeskApp />);
    expect(screen.getByTestId('sidebar-tab-dashboard')).toHaveClass('on');
    expect(screen.getByTestId('sidebar-tab-inventory')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-sales')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-clients')).toBeInTheDocument();
    expect(within(screen.getByTestId('mobile-tab-bar')).queryByTestId('sidebar-tab-tradeins')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-tab-reports')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-tab-service')).not.toBeInTheDocument();
  });

  it('slides the yellow indicator with translateX when the section changes from the bar or the hash', async () => {
    usePhone();
    const restore = installTabRects();
    window.location.hash = '#/dash';
    render(<DeskApp />);
    expect(screen.queryByTestId('mobile-tab-indicator')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-dashboard')).toHaveClass('on');

    fireEvent.click(screen.getByTestId('sidebar-tab-inventory'));
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(screen.getByTestId('sidebar-tab-inventory')).toHaveClass('on');
    expect(screen.getByTestId('mobile-tab-indicator')).toHaveStyle({ transform: 'translateX(8px)', width: '132px' });

    await act(async () => {
      await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    });
    expect(screen.getByTestId('mobile-tab-indicator')).toHaveStyle({
      transform: 'translateX(148px)',
      width: '118px',
      transition: MOBILE_TAB_INDICATOR_TRANSITION,
    });

    goHash('#/ven');
    await act(async () => {
      await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
    });
    expect(screen.getByTestId('sidebar-tab-sales')).toHaveClass('on');
    expect(screen.getByTestId('mobile-tab-indicator')).toHaveStyle({ transform: 'translateX(220px)', width: '96px' });
    restore();
  });

  it('explains the complete mobile group badge with an accessible description without extra text', () => {
    usePhone();
    window.location.hash = '#/comercial/ventas';
    context.operationNotifications = [
      { id: 'explain', storeId: 's', section: 'sales', title: 'Venta', message: 'Aviso de prueba', recordId: 'missing', kind: 'INTEGRATED_OPERATION', createdAt: '2026-10-08T12:00:00.000Z', readAt: null },
    ];
    context.sectionChanges = { sales: [{ id: 'missing', updatedAt: '2026-10-08T12:00:00.000Z' }], tradeins: [{ id: 't1', updatedAt: '2026-10-08T12:00:00.000Z' }] };
    render(<DeskApp />);
    const sales = within(screen.getByTestId('mobile-tab-bar')).getByRole('button', { name: 'Ventas' });
    expect(sales).toHaveAccessibleDescription('1 aviso sin leer en Ventas; 1 aviso sin leer en Canjes');
    expect(sales.querySelector('.dcount')).toHaveTextContent('2');
    expect(sales).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('1 aviso sin leer en Ventas; 1 aviso sin leer en Canjes.')).not.toBeInTheDocument();
    expect(screen.queryByText('Qué cuenta cada indicador')).not.toBeInTheDocument();
    context.operationNotifications = [];
  });

  it('keeps the indicator still when reduced motion is requested', () => {
    usePhone(true);
    const restore = installTabRects();
    window.location.hash = '#/dash';
    render(<DeskApp />);
    expect(screen.queryByTestId('mobile-tab-indicator')).not.toBeInTheDocument();

    goHash('#/inv');
    expect(screen.getByTestId('sidebar-tab-inventory')).toHaveClass('on');
    expect(screen.queryByTestId('mobile-tab-indicator')).not.toBeInTheDocument();
    restore();
  });
});

describe('mobile tab indicator geometry', () => {
  it('places the pill on the active button using translate offsets', () => {
    const frame = mobileTabIndicatorFrame(
      { left: 10, top: 700 } as DOMRect,
      { left: 84, top: 708, width: 120, height: 46 } as DOMRect,
    );
    expect(frame).toEqual({ x: 74, y: 8, width: 120, height: 46 });
    expect(sameIndicatorFrame(frame, { ...frame })).toBe(true);
    expect(sameIndicatorFrame(frame, { ...frame, x: frame.x + 2 })).toBe(false);
    expect(clampIndicatorFrame({ x: 300, y: 8, width: 90, height: 46 }, 340, 62)).toEqual({ x: 250, y: 8, width: 90, height: 46 });
  });
});
