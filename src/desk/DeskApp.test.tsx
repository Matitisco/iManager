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
    context.loadCommissions = undefined;
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

  const analysisRoutes = {
    reports: 'reportes', commissions: 'comisiones', history: 'historial', periodicSummary: 'resumen-periodico',
  };
  const transitions = [390, 1440].flatMap(width => Object.entries(analysisRoutes).flatMap(([source, path]) =>
    Object.entries(analysisRoutes).filter(([target]) => source !== target).map(([target, targetPath]) => ({ width, path, target, targetPath })),
  ));
  it.each(transitions)('conserva el resumen periódico de $path a $targetPath a $width px', async ({ width, path, target, targetPath }) => {
    if (width === 390) usePhone();
    context.loadCommissions = vi.fn(async () => undefined);
    window.location.hash = `#/analisis/${path}`;
    render(<DeskApp />);
    if (width === 390) fireEvent.click(screen.getByTestId('sidebar-tab-more'));
    const menu = await screen.findByRole('navigation', { name: 'Navegación principal' });
    expect(within(menu).getByText('Resumen periódico')).toBeVisible();
    const label = target === 'periodicSummary' ? 'Resumen periódico' : target === 'reports' ? 'Reportes' : target === 'history' ? 'Historial' : 'Comisiones';
    fireEvent.click(within(menu).getByRole('button', { name: label }));
    await waitFor(() => expect(window.location.hash).toBe(`#/analisis/${targetPath}`));
    await waitFor(() => expect(Boolean(document.querySelector('.periodic-summary'))).toBe(target === 'periodicSummary'));
    if (width === 1440) expect(within(menu).getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('tablist', { name: 'Secciones del grupo' })).not.toBeInTheDocument();
  });

  it.each([390, 1440])('restaura el resumen periódico desde la URL a %spx', width => {
    if (width === 390) usePhone();
    window.location.hash = '#/analisis/resumen-periodico';
    render(<DeskApp />);
    if (width === 1440) expect(screen.getByRole('button', { name: 'Resumen periódico' })).toHaveAttribute('aria-current', 'page');
    expect(document.querySelector('.periodic-summary')).toBeInTheDocument();
  });

  it.each([false, true])('protege la ruta del resumen con el permiso Reportes (habilitado=%s)', granted => {
    context.appSession.membership.role = 'STAFF';
    context.appSession.membership.sections = granted ? ['reports'] : [];
    window.location.hash = '#/analisis/resumen-periodico';
    render(<DeskApp />);
    expect(Boolean(screen.queryByTestId('no-section-access'))).toBe(!granted);
    expect(screen.queryByRole('tablist', { name: 'Secciones del grupo' })).not.toBeInTheDocument();
    expect(Boolean(document.querySelector('.periodic-summary'))).toBe(granted);
  });

  it('shows the dashboard without an alert when loading section changes fails', () => {
    context.sectionChangesError = 'No se pudieron cargar las novedades.';
    window.location.hash = '#/dashboard';
    render(<DeskApp />);
    expect(screen.getByTestId('dashboard-initial-loading')).toBeInTheDocument();
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
      fireEvent.click(screen.getByTestId('sidebar-tab-suppliers'));
    }
    await waitFor(() => expect(location.hash).toBe('#/finanzas/proveedores'));
    expectHidden();
    goHash('#/atencion/clientes');
    await screen.findByRole('button', { name: 'Todos' });
    expectHidden();
    expect(document.querySelector('.acct-views')).toBeNull();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    if (width === 1440) expect(screen.getByTestId('sidebar-tab-service')).toBeVisible();
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

  it('keeps pending badges in the accordion and marks the selected destination', async () => {
    window.location.hash = '#/dashboard';
    context.sectionChanges = { inventory: [{ id: 'p', updatedAt: '2026-10-08' }], tradeins: [{ id: 't1', updatedAt: '2026-10-08' }] };
    render(<DeskApp />);
    const sidebar = within(document.querySelector('aside.side')! as HTMLElement);
    const commercial = sidebar.getByRole('button', { name: /Comercial/ });
    expect(commercial).toHaveAttribute('aria-expanded', 'false');
    expect(within(commercial).getByLabelText('1 aviso sin leer en Canjes')).toHaveTextContent('1');
    fireEvent.click(commercial);
    expect(commercial).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(sidebar.getByTestId('sidebar-tab-tradeins'));
    await waitFor(() => expect(sidebar.getByTestId('sidebar-tab-tradeins')).toHaveAttribute('aria-current', 'page'));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(sidebar.getByRole('button', { name: /Stock/ }));
    expect(commercial).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar.getByTestId('sidebar-tab-inventory')).toBeVisible();
    expect(within(sidebar.getByTestId('sidebar-tab-inventory')).getByLabelText('1 aviso sin leer en Equipos')).toHaveTextContent('1');
    expect(sidebar.queryByRole('button', { name: 'Canjes' })).not.toBeInTheDocument();
  });

  it.each([390, 1440])('navega a Control de stock por el menú y vuelve a Equipos a %spx', async width => {
    if (width === 390) usePhone();
    window.location.hash = '#/stock/equipos';
    render(<DeskApp />);
    expect(screen.getByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    if (width === 390) {
      fireEvent.click(screen.getByTestId('sidebar-tab-more'));
      await screen.findByTestId('more-screen');
    }
    fireEvent.click(screen.getByTestId('sidebar-tab-stockCount'));
    expect(await screen.findByTestId('stock-count-page')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/stock/control');
    if (width === 390) {
      fireEvent.click(screen.getByTestId('sidebar-tab-more'));
      await screen.findByTestId('more-screen');
      fireEvent.click(screen.getByTestId('more-item-inventory'));
    } else {
      expect(screen.getByTestId('sidebar-tab-stockCount')).toHaveAttribute('aria-current', 'page');
      fireEvent.click(screen.getByTestId('sidebar-tab-inventory'));
    }
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/stock/equipos');
    expect(screen.queryByTestId('stock-count-page')).not.toBeInTheDocument();
  });

  it.each([390, 1440])('clears only the visited section badge, retains marks during the visit and clears them on return at %spx', async width => {
    if (width === 390) usePhone();
    window.location.hash = '#/dashboard';
    const versions = Array.from({ length: 12 }, (_, i) => ({ id: `t${i + 1}`, updatedAt: '2026-10-08T12:00:00.000Z' }));
    context.sectionChanges = { tradeins: versions, sales: [{ id: 's1', updatedAt: versions[0].updatedAt }] };
    context.viewSection = vi.fn(async (section: ViewSection) => { context.sectionChanges = { ...context.sectionChanges, [section]: [] }; });
    const view = render(<DeskApp />);
    const container = width === 390 ? screen.getByTestId('mobile-tab-bar') : document.querySelector('aside.side')! as HTMLElement;
    const badge = () => width === 390 ? within(container).getByRole('button', { name: 'Ventas' }).querySelector('.dcount') : within(within(container).getByRole('button', { name: /Comercial/ })).getByLabelText(/aviso.*en Ventas/);
    expect(badge()).toHaveTextContent('13');
    if (width === 390) expect(within(container).getByRole('button', { name: 'Ventas' })).toHaveAccessibleDescription('1 aviso sin leer en Ventas; 12 avisos sin leer en Canjes');
    goHash('#/comercial/canjes');
    await waitFor(() => expect(context.viewSection).toHaveBeenCalledWith('tradeins', versions));
    view.rerender(<DeskApp />);
    if (width === 1440) expect(screen.getByTestId('sidebar-tab-tradeins')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(badge()).toHaveTextContent('1');
    expect(screen.getAllByTestId('notice-dot')).toHaveLength(1);
    goHash('#/dashboard');
    goHash('#/comercial/canjes');
    await screen.findByRole('heading', { name: 'Canjes', level: 1 });
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
    expect(within(screen.getByTestId('sidebar-tab-tradeins')).getByLabelText('1 aviso sin leer en Canjes')).toHaveTextContent('1');
    expect(screen.getByTestId('more-item-clients')).toHaveTextContent('Clientes');
    expect(screen.getByTestId('sidebar-tab-service')).toHaveTextContent('Servicio técnico');
    expect(within(screen.getByTestId('sidebar-tab-notifications')).getByLabelText('1 notificación sin leer')).toHaveTextContent('1');
    expect(screen.getByTestId('sidebar-tab-settings')).toHaveTextContent('Configuración');
    expect(screen.getByTestId('sidebar-tab-more')).toHaveClass('on');
    expect(screen.getByTestId('sidebar-tab-reports')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-tab-commissions')).toHaveTextContent('Comisiones');
    expect(screen.queryByText(/Tentativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/propuesta/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-header')).toHaveTextContent('iManager');
    expect(screen.getByTestId('mobile-store-name')).toHaveTextContent('Casa');
  });

  it('never shows a connection banner on Dashboard when the browser goes offline or online', async () => {
    usePhone();
    window.location.hash = '#/dash';
    render(<DeskApp />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event('offline')); });
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
    expect(screen.getByTestId('dashboard-initial-loading')).toBeInTheDocument();
  });

  it('keeps all phone sections quiet while onLine stays false', async () => {
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
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();

      goHash('#/inv');
      expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();

      goHash('#/clientes');
      expect(await screen.findByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

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

  it('keeps Más and Clientes quiet while health probes detect and recover a failed connection', async () => {
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
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
      await waitFor(() => expect(probes.some((probe) => probe.url.includes('/api/health?_=') && probe.cache === 'no-store')).toBe(true), { timeout: 4000 });
      expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument();
      expect(screen.getByTestId('mobile-tab-bar')).toBeInTheDocument();

      goHash('#/clientes');
      expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

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

  it.each([new TypeError('Failed to fetch'), new Error('No se pudieron cargar las comisiones')])('hides a failed secondary commission count on Más: %s', async cause => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    usePhone();
    window.location.hash = '#/mas';
    context.user = { uid: 'u' };
    context.backendStatus = 'ready';
    context.loadCommissions = vi.fn().mockRejectedValue(cause);
    try {
      render(<DeskApp />);
      await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudieron cargar las comisiones.', cause));
      expect(screen.getByRole('heading', { name: 'Más' })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
      expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
      expect(document.querySelector('.ferr')).not.toBeInTheDocument();
    } finally {
      cleanup();
      warn.mockRestore();
      context.user = null;
      context.backendStatus = 'checking';
      context.loadCommissions = undefined;
    }
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
