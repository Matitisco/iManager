import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/api-client';
import { PANEL_STEPS, type FunnelResponse } from '../lib/admin-panel';
import type { StoreActivityResponse, StoreActivityRow } from '../lib/store-activity';
import { StoreActivityPage } from './StoreActivity';

const user = vi.hoisted(() => ({
  uid: 'admin',
  email: 'admin@internal.test',
  displayName: 'Admin',
  getIdToken: async () => 'token',
}));

const fetchFunnel = vi.hoisted(() => vi.fn());
const fetchStoreTimeline = vi.hoisted(() => vi.fn());
const fetchAdminAccess = vi.hoisted(() => vi.fn());
const fetchStoreActivity = vi.hoisted(() => vi.fn());

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({ user }),
}));

vi.mock('../services/admin-activity-api', () => ({
  fetchStoreActivity,
  fetchAdminAccess,
  fetchFunnel,
  fetchStoreTimeline,
}));

function store(patch: Partial<StoreActivityRow> & Pick<StoreActivityRow, 'id' | 'name' | 'createdAt'>): StoreActivityRow {
  return {
    ownerEmail: 'ma***@tienda.com',
    billingPlan: 'INTERNAL',
    billingStatus: 'ACTIVE',
    trialEndsAt: null,
    onboardingStage: 'stock',
    counts: { storeMembers: 2, inventoryItems: 4, sales: 1, clients: 3, repairOrders: 0 },
    lastActivityAt: null,
    ...patch,
  };
}

const payload: StoreActivityResponse = {
  range: '30d',
  generatedAt: '2026-10-17T19:42:00.000Z',
  stores: [
    store({ id: 'club', name: 'iphoneclub', createdAt: '2026-10-10T15:00:00.000Z', lastActivityAt: '2026-10-16T18:00:00.000Z', billingPlan: 'INTERNAL', onboardingStage: 'stock', stuckAt: 'real_stock', activeDays30: 6 }),
    store({ id: 'one', name: '1St', ownerEmail: 'cl***@tienda.com', createdAt: '2026-09-01T15:00:00.000Z', lastActivityAt: '2026-10-17T18:00:00.000Z' }),
    store({ id: 'qa', name: 'QA-caja', ownerEmail: 'qa***@gmail.com', createdAt: '2026-10-12T15:00:00.000Z' }),
    store({ id: 'demo', name: 'Local', ownerEmail: 'de***@example.com', createdAt: '2026-10-11T15:00:00.000Z', lastActivityAt: '2026-10-11T15:00:00.000Z' }),
  ],
};

function media(phone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: phone && query.includes('760'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const funnelPayload: FunnelResponse = { range: '30d', generatedAt: payload.generatedAt, steps: PANEL_STEPS.map(([id, label], i) => ({ id, label, count: [25,21,20,17,9,15,8,3,2,4,1,8][i], pctOfStart: 0, dropFromPrev: 0 })), stockMethods: [{ method: 'excel', chosen: 9, finishedOk: 5, abandoned: 4 }], retention: { cohort: 25, nextDay: 8, week1Active: 9 }, medianHours: { signupToStore: 2/60, storeToRealStock: 24, storeToFirstSale: 72 } };

describe('StoreActivityPage', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    fetchAdminAccess.mockReset().mockResolvedValue({ isAdmin: true });
    fetchStoreActivity.mockReset();
    fetchStoreActivity.mockImplementation(async (_user: unknown, range: '30d' | 'all') => ({ ...payload, range }));
    media(false);
    window.history.replaceState(null, '', '/admin/actividad');
    window.scrollTo = vi.fn();
    fetchFunnel.mockReset().mockResolvedValue(funnelPayload);
    fetchStoreTimeline.mockReset().mockResolvedValue({ store: { ...payload.stores[0], stuckAt: null, activeDays30: 6 }, events: [{ name: 'signup', at: '2026-10-16T17:02:00Z', props: { provider: 'google' }, source: 'server' }] });
  });

  it('shows a not-found screen when the API answers 404 and no link into the panel', async () => {
    fetchStoreActivity.mockRejectedValue(new ApiError(404, 'No encontrado'));
    render(<StoreActivityPage />);

    expect(await screen.findByTestId('activity-not-found')).toHaveTextContent('No encontramos esta página');
    expect(screen.queryByRole('heading', { name: 'Actividad de tiendas' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin|actividad/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });

  it('does not fetch or show activity when the capability is false', async () => {
    fetchAdminAccess.mockResolvedValue({ isAdmin: false });
    render(<StoreActivityPage />);
    expect(await screen.findByTestId('activity-not-found')).toHaveTextContent('No encontramos esta página');
    expect(fetchStoreActivity).not.toHaveBeenCalled();
  });

  it('hides activity when permission is revoked with 403', async () => {
    fetchStoreActivity.mockRejectedValue(new ApiError(403, 'Forbidden'));
    render(<StoreActivityPage />);
    expect(await screen.findByTestId('activity-not-found')).toHaveTextContent('No encontramos esta página');
    expect(screen.queryByTestId('activity-table')).not.toBeInTheDocument();
  });

  it('lists real stores in a table, hides test stores, and can sort or widen the range', async () => {
    const userEvents = userEvent.setup();
    render(<StoreActivityPage />);

    const table = await screen.findByTestId('activity-table');
    expect(fetchStoreActivity).toHaveBeenCalledWith(user, '30d');
    expect(screen.getByRole('heading', { name: 'Actividad de tiendas' })).toBeInTheDocument();
    expect(screen.getByText(/actualizado 17\/10\/2026 16:42/)).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(rows).toEqual(['iphoneclub', '1St']);
    expect(within(table).getByText('10/10/2026 12:00')).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Se frenó en' })).toBeInTheDocument();
    expect(within(table).getAllByText('Al día')).toHaveLength(1);
    for (const name of ['Plan', 'Estado', 'Prueba hasta']) expect(within(table).queryByRole('columnheader', { name })).not.toBeInTheDocument();
    expect(within(table).getByText('Cargar stock')).toHaveClass('chip');
    expect(within(table).getByText('ma***@tienda.com')).toBeInTheDocument();
    expect(screen.queryByText('QA-caja')).not.toBeInTheDocument();
    expect(screen.queryByText('de***@example.com')).not.toBeInTheDocument();
    expect(screen.getByText(/ocultamos 2 tiendas de prueba/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await userEvents.click(screen.getByRole('button', { name: 'Por actividad' }));
    const byActivity = within(screen.getByTestId('activity-table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(byActivity).toEqual(['1St', 'iphoneclub']);

    await userEvents.click(screen.getByRole('button', { name: 'Ocultar tiendas de prueba' }));
    expect(await screen.findByText('QA-caja')).toBeInTheDocument();
    expect(screen.getByText('de***@example.com')).toBeInTheDocument();

    await userEvents.click(screen.getByRole('button', { name: 'Todas' }));
    await waitFor(() => expect(fetchStoreActivity).toHaveBeenCalledWith(user, 'all'));
  });

  it.each(['/admin/actividad', '/admin/actividad/embudo', '/admin/actividad/tienda/club'])('denies data on %s without admin capability', async path => {
    window.history.replaceState(null, '', path);
    fetchAdminAccess.mockResolvedValue({ isAdmin: false });
    render(<StoreActivityPage />);
    expect(await screen.findByTestId('activity-not-found')).toBeVisible();
    expect(fetchStoreActivity).not.toHaveBeenCalled(); expect(fetchFunnel).not.toHaveBeenCalled(); expect(fetchStoreTimeline).not.toHaveBeenCalled();
  });

  it('renders twelve noninteractive steps, positive KPI percentages and one largest drop', async () => {
    window.history.replaceState(null, '', '/admin/actividad/embudo');
    render(<StoreActivityPage />);
    expect(await screen.findByText('Cargó stock real')).toBeVisible();
    expect(screen.getAllByTestId(/^funnel-step-/)).toHaveLength(12);
    expect(screen.getAllByText('sin abandono')).toHaveLength(3);
    expect(screen.getAllByText(/el mayor abandono/)).toHaveLength(1);
    expect(screen.getByText(/−8 se frenaron acá · el mayor abandono/)).toBeInTheDocument();
    expect(screen.getByTestId('funnel-step-real_stock')).toHaveClass('max');
    expect(screen.getByTestId('funnel-kpi-1')).toHaveTextContent('36 % de los registros');
    expect(screen.getByTestId('funnel-kpi-2')).toHaveTextContent('32 % de los registros');
    expect(screen.queryByRole('button', { name: 'Por alta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargó stock real' })).not.toBeInTheDocument();
  });

  it('highlights only the first tied largest drop and none when all steps are equal', async () => {
    const tied = { ...funnelPayload, steps: funnelPayload.steps.map((s, i) => ({ ...s, count: [25,17,9,9,9,9,9,9,9,9,9,9][i] })) };
    fetchFunnel.mockResolvedValue(tied);
    window.history.replaceState(null, '', '/admin/actividad/embudo');
    const { unmount } = render(<StoreActivityPage />);
    expect(await screen.findByText(/el mayor abandono/)).toBeInTheDocument();
    expect(screen.getAllByText(/el mayor abandono/)).toHaveLength(1);
    unmount();
    fetchFunnel.mockResolvedValue({ ...tied, steps: tied.steps.map(s => ({ ...s, count: 25 })) });
    render(<StoreActivityPage />);
    expect(await screen.findAllByText('sin abandono')).toHaveLength(11);
    expect(screen.queryByText(/el mayor abandono/)).not.toBeInTheDocument();
  });

  it('navigates tabs and timeline with shared filters and browser history', async () => {
    const u = userEvent.setup();
    render(<StoreActivityPage />);
    await screen.findByTestId('activity-table');
    await u.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(fetchStoreActivity).toHaveBeenLastCalledWith(user, '7d'));
    await screen.findByTestId('activity-table');
    await u.click(screen.getByRole('button', { name: 'Embudo' }));
    await screen.findByTestId('funnel-kpi-0');
    expect(window.location.pathname).toBe('/admin/actividad/embudo');
    expect(fetchFunnel).toHaveBeenLastCalledWith(user, '7d', true);
    await u.click(screen.getByRole('button', { name: 'Tiendas' }));
    await screen.findByTestId('activity-table');
    await u.click(screen.getByTestId('activity-row-club'));
    expect(await screen.findByText('Se registró con Google')).toBeVisible();
    expect(window.location.pathname).toBe('/admin/actividad/tienda/club');
    expect(screen.getByText('Al día')).toHaveClass('ok');
    await u.click(screen.getByRole('link', { name: 'Actividad' }));
    await screen.findByTestId('activity-table');
    window.history.back();
    await waitFor(() => expect(screen.getByText('Se registró con Google')).toBeVisible());
    expect(screen.getAllByLabelText(/completado|siguiente|pendiente/)).toHaveLength(12);
  });

  it('renders AR day groups, compact collapsed entries and translated amber events', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T15:00:00Z'));
    window.history.replaceState(null, '', '/admin/actividad/tienda/club');
    fetchStoreTimeline.mockResolvedValue({ store: { ...payload.stores[0], stuckAt: 'real_stock', activeDays30: 2 }, events: [
      { name: 'signup', at: '2026-10-16T17:02:00Z', props: { provider: 'google' }, source: 'server' },
      { name: 'stock_import_abandoned', at: '2026-10-18T12:22:00Z', props: { method: 'excel', at: 'review' }, source: 'client' },
      { name: 'active_day', at: '2026-10-18T02:01:00Z', props: { device: 'phone' }, source: 'server' },
      { name: 'active_day', at: '2026-10-18T02:00:00Z', props: { device: 'phone' }, source: 'server' },
    ] });
    render(<StoreActivityPage />);
    expect(await screen.findByText('Se frenó en Cargar stock')).toHaveClass('chip');
    expect(screen.getByRole('region', { name: 'Hoy' })).toHaveTextContent('09:22');
    expect(screen.getByRole('region', { name: 'Ayer' })).toHaveTextContent('23:01');
    expect(screen.getAllByText('Entró · celular')).toHaveLength(1);
    expect(screen.getByText('Entró · celular').closest('.ev')).toHaveClass('compact');
    expect(screen.getByText('Cerró el Excel sin importar (en Revisar)').closest('.ev')).toHaveClass('neg');
    expect(screen.getByRole('region', { name: 'Vie 16/10' })).toHaveTextContent('Se registró con Google');
  });

  it('uses the existing empty, retry and missing timeline states', async () => {
    window.history.replaceState(null, '', '/admin/actividad/embudo');
    fetchFunnel.mockRejectedValueOnce(new Error('Sin conexión'));
    render(<StoreActivityPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    fetchFunnel.mockResolvedValue({ ...funnelPayload, steps: funnelPayload.steps.map(s => ({ ...s, count: 0 })) });
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Todavía no hay datos de este período')).toHaveClass('wempty');
  });

  it('shows missing for an unknown store', async () => {
    window.history.replaceState(null, '', '/admin/actividad/tienda/missing');
    fetchStoreTimeline.mockRejectedValue(new ApiError(404, 'Not found'));
    render(<StoreActivityPage />);
    expect(await screen.findByTestId('activity-not-found')).toBeVisible();
  });

  it('uses cards on a phone' , async () => {
    media(true);
    render(<StoreActivityPage />);
    expect(await screen.findByTestId('activity-card-club')).toHaveTextContent('iphoneclub');
    expect(screen.queryByTestId('activity-table')).not.toBeInTheDocument();
    expect(screen.queryByText('QA-caja')).not.toBeInTheDocument();
  });
});
