import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedCatalog } from '../../types/public-catalog';
import { NETWORK_ERROR_MESSAGE } from '../../lib/user-message';
import { DeskProvider } from '../ui';
import { PublicCatalogScreen } from './PublicCatalogScreen';

const context = vi.hoisted(() => ({
  publicCatalog: null as ManagedCatalog | null,
  loadPublicCatalog: vi.fn(async () => context.publicCatalog),
  savePublicCatalog: vi.fn(),
  setCatalogVisibility: vi.fn(),
  appSession: { store: { phone: '123123', name: 'Mi Tienda', currency: 'USD' } },
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/public-catalog-api', () => ({ fetchPublicCatalog: vi.fn(async () => null) }));

function catalog(): ManagedCatalog {
  return {
    slug: 'mi-tienda', active: true, hideWithoutStock: true, hideReserved: true, minBattery: null,
    showPrice: true, priceCurrency: 'USD', logoUrl: null, hours: null,
    counts: { visible: 1, rules: 1, manual: 0, available: 1 },
    items: [
      { id: '1', model: 'iPhone 15', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', price: 800, currency: 'USD', catalogVisible: true, reason: null },
      { id: '2', model: 'iPhone 12', capacity: '64GB', color: 'Rojo', condition: 'USADO', grade: 'B', batteryHealth: '80%', price: 300, currency: 'USD', catalogVisible: false, reason: 'Regla: sin stock' },
    ],
  };
}

const open = vi.fn();
function renderScreen() {
  open.mockReset();
  return render(
    <DeskProvider value={{ tab: 'publicCatalog', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <PublicCatalogScreen />
    </DeskProvider>,
  );
}

describe('catalog section', () => {
  beforeEach(() => {
    context.publicCatalog = catalog();
    context.appSession.store.phone = '123123';
    context.loadPublicCatalog.mockReset();
    context.loadPublicCatalog.mockImplementation(async () => context.publicCatalog);
  });

  it('counts available devices and links an invalid WhatsApp to store settings', async () => {
    renderScreen();
    expect(await screen.findByText('1 disponible')).toBeInTheDocument();
    expect(screen.queryByText('2 disponibles')).not.toBeInTheDocument();
    expect(screen.getByText(/Cargá un WhatsApp válido para que tus clientes te escriban/)).toBeInTheDocument();
    screen.getByRole('button', { name: 'Configuración de la tienda' }).click();
    expect(open).toHaveBeenCalledWith({ type: 'store', focus: 'phone' });
  });

  it('hides the phone warning when the store number can open WhatsApp', async () => {
    context.appSession.store.phone = '11 5555 1234';
    renderScreen();
    expect(await screen.findByText('1 disponible')).toBeInTheDocument();
    expect(screen.queryByText(/Cargá un WhatsApp válido/)).not.toBeInTheDocument();
  });

  it('clears the offline banner and retries when the browser is online again', async () => {
    context.publicCatalog = null;
    context.loadPublicCatalog.mockReset();
    context.loadPublicCatalog.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockImplementation(async () => context.publicCatalog);
    renderScreen();
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
    context.publicCatalog = catalog();
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
    expect(await screen.findByText('1 disponible')).toBeInTheDocument();
  });
});
