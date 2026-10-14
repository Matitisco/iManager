import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicCatalogPage } from './PublicCatalogPage';
import { ApiError } from '../services/api-client';
import { NETWORK_ERROR_MESSAGE } from '../lib/user-message';
const { fetchCatalog } = vi.hoisted(() => ({ fetchCatalog: vi.fn() }));
vi.mock('../services/public-catalog-api', () => ({ fetchPublicCatalog: fetchCatalog }));
const catalog = { store: { name: 'Mi Tienda', phone: '+54 9 11 55551234', address: 'Av. Corrientes 1234', logoUrl: null, hours: 'Lun a sáb 10–19', currency: 'USD' }, active: true, showPrice: true, priceCurrency: 'USD', items: [{ model: 'iPhone 15 Pro', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A+', batteryHealth: '90%', price: 920, currency: 'USD' }] };
afterEach(() => vi.clearAllMocks());
describe('public catalog without session', () => {
  it('renders a price list without photos, a single WhatsApp contact and search', async () => {
    fetchCatalog.mockResolvedValue(catalog);
    render(<PublicCatalogPage slug="mi-tienda" />);
    expect(await screen.findByRole('heading', { name: 'Mi Tienda' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText(/iniciar sesión/i)).not.toBeInTheDocument();
    expect(screen.getByText('US$ 920')).toBeInTheDocument();
    expect(screen.getByText(/precios en USD/)).toBeInTheDocument();
    expect(screen.queryByText(/moneda por equipo/)).not.toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: 'Escribinos por WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/5491155551234\?text=/));
    expect(decodeURIComponent(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')!)).toContain('👋');
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar modelo o color' }), { target: { value: 'Azul' } });
    expect(screen.getByText('No hay equipos con estos filtros')).toBeInTheDocument();
  });
  it('hides prices and price filters completely', async () => {
    fetchCatalog.mockResolvedValue({ ...catalog, showPrice: false, items: catalog.items.map(({ price, currency, ...item }) => item) });
    render(<PublicCatalogPage slug="mi-tienda" />);
    await screen.findByText('Consultá');
    expect(screen.queryByLabelText('Precio desde')).not.toBeInTheDocument();
    expect(screen.queryByText('US$ 920')).not.toBeInTheDocument();
  });
  it('clears stale rows when a link is revoked, and can retry load errors', async () => {
    fetchCatalog.mockResolvedValueOnce(catalog).mockRejectedValue(new ApiError(404, 'Catálogo no disponible'));
    render(<PublicCatalogPage slug="mi-tienda" />);
    await screen.findByText('US$ 920');
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(screen.queryByText('US$ 920')).not.toBeInTheDocument());
    expect(screen.getByText('Esta lista de precios no está disponible')).toBeInTheDocument();
  });
  it('hides WhatsApp without a valid phone and names the store currency when prices stay as loaded', async () => {
    fetchCatalog.mockResolvedValue({ ...catalog, priceCurrency: 'ORIGINAL', store: { ...catalog.store, phone: '123123', currency: 'ARS' } });
    render(<PublicCatalogPage slug="mi-tienda" />);
    expect(await screen.findByText(/precios en ARS/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Escribinos por WhatsApp' })).not.toBeInTheDocument();
  });
  it('clears the offline banner and reloads when the connection returns', async () => {
    fetchCatalog.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(catalog);
    render(<PublicCatalogPage slug="mi-tienda" />);
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(await screen.findByText('US$ 920')).toBeInTheDocument();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
});
