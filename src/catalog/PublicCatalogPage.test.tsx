import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it('keeps the header phone and the WhatsApp link on the same current number', async () => {
    let phone = '123123';
    fetchCatalog.mockImplementation(async () => ({ ...catalog, store: { ...catalog.store, phone } }));
    const view = render(<PublicCatalogPage slug="mi-tienda" />);
    expect(await screen.findByTestId('catalog-store-phone')).toHaveTextContent('123123');
    expect(screen.queryByRole('link', { name: 'Escribinos por WhatsApp' })).not.toBeInTheDocument();
    phone = '11 4172 2188';
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByTestId('catalog-store-phone')).toHaveTextContent('11 4172 2188');
    expect(screen.getByTestId('catalog-store-phone')).not.toHaveTextContent('123123');
    expect(screen.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5491141722188?text='));
    view.unmount();
  });
  it('hides WhatsApp without a valid phone and describes original prices by equipment currency', async () => {
    fetchCatalog.mockResolvedValue({ ...catalog, priceCurrency: 'ORIGINAL', store: { ...catalog.store, phone: '123123', currency: 'ARS' } });
    render(<PublicCatalogPage slug="mi-tienda" />);
    expect(await screen.findByText(/moneda por equipo/)).toBeInTheDocument();
    expect(screen.getByText('US$ 920')).toBeInTheDocument();
    expect(screen.queryByText(/precios en ARS/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByLabelText('Precio desde').previousElementSibling).toBeEmptyDOMElement();
    expect(screen.queryByRole('link', { name: 'Escribinos por WhatsApp' })).not.toBeInTheDocument();
  });
  it('filters with chips in the page and inside the mobile sheet', async () => {
    fetchCatalog.mockResolvedValue({ ...catalog, items: [catalog.items[0], { ...catalog.items[0], model: 'iPhone 14', capacity: '256GB', color: 'Azul', price: 590 }] });
    render(<PublicCatalogPage slug="mi-tienda" />);
    expect(await screen.findByText('US$ 920')).toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Capacidad' }));
    fireEvent.click(screen.getByRole('option', { name: '128GB' }));
    expect(screen.queryByText('US$ 590')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros · 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros · 1' }));
    const dialog = screen.getByRole('dialog', { name: 'Filtrar lista' });
    expect(within(dialog).getByRole('button', { name: '128GB' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Cualquiera' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Precio desde')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '256GB' }));
    expect(screen.getByText('US$ 590')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Ver 1 equipo' })).toBeInTheDocument();
  });
  it('renders no network notice or empty state and reloads when the connection returns', async () => {
    fetchCatalog.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(catalog);
    render(<PublicCatalogPage slug="mi-tienda" />);
    await waitFor(() => expect(screen.queryByTestId('public-catalog-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Esta lista de precios no está disponible')).not.toBeInTheDocument();
    expect(screen.queryByText('Estamos actualizando la lista')).not.toBeInTheDocument();
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(await screen.findByText('US$ 920')).toBeInTheDocument();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
  it('silently recovers when the phone is online again without an online event', async () => {
    let online = false;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
    try {
      fetchCatalog.mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValue(catalog);
      render(<PublicCatalogPage slug="mi-tienda" />);
      await waitFor(() => expect(screen.queryByTestId('public-catalog-loading')).not.toBeInTheDocument());
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
      online = true;
      await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
      expect(await screen.findByText('US$ 920')).toBeInTheDocument();
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });
});
