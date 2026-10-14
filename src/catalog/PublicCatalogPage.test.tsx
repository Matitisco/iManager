import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicCatalogPage } from './PublicCatalogPage';
import { ApiError } from '../services/api-client';
const { fetchCatalog } = vi.hoisted(() => ({ fetchCatalog: vi.fn() }));
vi.mock('../services/public-catalog-api', () => ({ fetchPublicCatalog: fetchCatalog }));
const catalog = { store: { name: 'Mi Tienda', phone: '+54 9 11 55551234', address: 'Av. Corrientes 1234', logoUrl: null, hours: 'Lun a sáb 10–19' }, active: true, showPrice: true, priceCurrency: 'USD', items: [{ model: 'iPhone 15 Pro', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A+', batteryHealth: '90%', price: 920, currency: 'USD' }] };
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
});
