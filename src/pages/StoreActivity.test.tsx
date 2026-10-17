import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/api-client';
import type { StoreActivityResponse, StoreActivityRow } from '../lib/store-activity';
import { StoreActivityPage } from './StoreActivity';

const user = vi.hoisted(() => ({
  uid: 'admin',
  email: 'admin@internal.test',
  displayName: 'Admin',
  getIdToken: async () => 'token',
}));

const fetchStoreActivity = vi.hoisted(() => vi.fn());

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({ user }),
}));

vi.mock('../services/admin-activity-api', () => ({
  fetchStoreActivity,
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
    store({ id: 'club', name: 'iphoneclub', createdAt: '2026-10-10T15:00:00.000Z', lastActivityAt: '2026-10-16T18:00:00.000Z', billingPlan: 'INTERNAL', onboardingStage: 'stock' }),
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

describe('StoreActivityPage', () => {
  beforeEach(() => {
    fetchStoreActivity.mockReset();
    fetchStoreActivity.mockImplementation(async (_user: unknown, range: '30d' | 'all') => ({ ...payload, range }));
    media(false);
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
    expect(within(table).getAllByText('Interno').length).toBeGreaterThan(0);
    expect(within(table).getByText('ma***@tienda.com')).toBeInTheDocument();
    expect(screen.queryByText('QA-caja')).not.toBeInTheDocument();
    expect(screen.queryByText('de***@example.com')).not.toBeInTheDocument();
    expect(screen.getByText(/ocultamos 2 tiendas de prueba/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    await userEvents.click(screen.getByRole('button', { name: 'Por actividad' }));
    const byActivity = within(screen.getByTestId('activity-table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(byActivity).toEqual(['1St', 'iphoneclub']);

    await userEvents.click(screen.getByRole('button', { name: 'Ocultar tiendas de prueba' }));
    expect(screen.getByText('QA-caja')).toBeInTheDocument();
    expect(screen.getByText('de***@example.com')).toBeInTheDocument();

    await userEvents.click(screen.getByRole('button', { name: 'Todas' }));
    await waitFor(() => expect(fetchStoreActivity).toHaveBeenCalledWith(user, 'all'));
  });

  it('uses cards on a phone', async () => {
    media(true);
    render(<StoreActivityPage />);
    expect(await screen.findByTestId('activity-card-club')).toHaveTextContent('iphoneclub');
    expect(screen.queryByTestId('activity-table')).not.toBeInTheDocument();
    expect(screen.queryByText('QA-caja')).not.toBeInTheDocument();
  });
});
