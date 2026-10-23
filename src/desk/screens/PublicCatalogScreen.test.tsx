import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedCatalog } from '../../types/public-catalog';
import { fetchPublicCatalog } from '../../services/public-catalog-api';
import { DeskProvider } from '../ui';
import { PublicCatalogScreen } from './PublicCatalogScreen';

const context = vi.hoisted(() => ({
  publicCatalog: null as ManagedCatalog | null,
  loadPublicCatalog: vi.fn(async () => context.publicCatalog),
  savePublicCatalog: vi.fn(),
  setCatalogVisibility: vi.fn(),
  regeneratePublicCatalog: vi.fn(),
  appSession: { membership: { role: 'OWNER' }, store: { phone: '123123', name: 'Mi Tienda', currency: 'USD' } },
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
  const content = () => (
    <DeskProvider value={{ tab: 'publicCatalog', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <PublicCatalogScreen />
    </DeskProvider>
  );
  const view = render(content());
  return { ...view, rerenderScreen: () => view.rerender(content()) };
}

describe('catalog section', () => {
  beforeEach(() => {
    context.publicCatalog = catalog();
    context.appSession.store.phone = '123123';
    context.loadPublicCatalog.mockReset();
    context.loadPublicCatalog.mockImplementation(async () => context.publicCatalog);
  });

  it('uses content placeholders until the first request settles, then shows the empty result', async () => {
    context.publicCatalog = null;
    let finish!: (value: null) => void;
    context.loadPublicCatalog.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderScreen();
    expect(screen.getByTestId('catalog-loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button', { name: 'Crear catálogo' })).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-screen').textContent).not.toMatch(/cargando|loading/i);
    await act(async () => { finish(null); });
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear catálogo' })).toBeInTheDocument();
    expect(screen.getByTestId('catalog-screen')).toHaveAttribute('aria-busy', 'false');
  });

  it('keeps the existing catalog visible when returning while its refresh is pending', () => {
    context.loadPublicCatalog.mockImplementation(() => new Promise(() => {}));
    renderScreen();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();
    expect(screen.getByText('1 disponible')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-screen')).toHaveAttribute('aria-busy', 'true');
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

  it.each([new Error('No se pudo cargar el catálogo'), new TypeError('Failed to fetch')])('shows nothing for a failed load: %s', async cause => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    context.publicCatalog = null;
    context.loadPublicCatalog.mockRejectedValue(cause);
    renderScreen();
    await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudo cargar el catálogo.', cause));
    expect(screen.queryByText('Sin catálogo para mostrar.')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith('No se pudo cargar el catálogo.', cause);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar|Crear catálogo/ })).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('keeps the managed catalog and hides a failed secondary preview', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cause = new Error('No se pudo cargar la vista previa');
    vi.mocked(fetchPublicCatalog).mockRejectedValueOnce(cause);
    context.loadPublicCatalog.mockRejectedValueOnce(cause);
    renderScreen();
    await waitFor(() => expect(warn).toHaveBeenCalledWith('No se pudo cargar la vista previa del catálogo.', cause));
    expect(warn).toHaveBeenCalledWith('No se pudo cargar el catálogo.', cause);
    expect(screen.getByText('1 disponible')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
    expect(document.querySelector('.ferr')).not.toBeInTheDocument();
    expect(screen.queryByText(cause.message)).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-preview-loading')).not.toBeInTheDocument();
    expect(document.querySelector('.cat-preview')).not.toBeInTheDocument();
    warn.mockRestore();
  });
});

function manyItems(total = 118): ManagedCatalog {
  const base = catalog();
  return {
    ...base,
    counts: { visible: total, rules: 0, manual: 0, available: total },
    items: Array.from({ length: total }, (_, index) => ({
      ...base.items[0], id: String(index + 1), model: `Equipo ${index + 1}`,
      color: index < 32 ? 'Azul' : 'Negro',
    })),
  };
}

describe('managed catalog pagination', () => {
  beforeEach(() => {
    context.publicCatalog = manyItems();
    context.appSession.store.phone = '11 5555 1234';
    context.loadPublicCatalog.mockReset();
    context.loadPublicCatalog.mockImplementation(async () => context.publicCatalog);
    context.setCatalogVisibility.mockReset();
    context.savePublicCatalog.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  async function equipmentList() {
    await screen.findByText('Página 1 de 8');
    return screen.getByRole('heading', { name: 'Equipos' }).closest('section')!;
  }

  it('renders 16 rows and places the range and pager at the bottom of the list card', async () => {
    const user = userEvent.setup();
    renderScreen();
    const list = await equipmentList();
    const pager = within(list).getByRole('navigation', { name: 'Paginación' });
    expect(list.querySelectorAll('.cat-equipment-row')).toHaveLength(16);
    expect(list.lastElementChild).toBe(pager);
    expect(within(pager).getByText('1–16 de 118')).toBeInTheDocument();
    expect(screen.queryByText('Equipo 17 · 128GB')).not.toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    expect(list.querySelectorAll('.cat-equipment-row')).toHaveLength(6);
    expect(screen.getByText('113–118 de 118')).toBeInTheDocument();
    expect(screen.getByText('Equipo 113 · 128GB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Página 1' }));
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    await user.click(screen.getByRole('button', { name: 'Página 4' }));
    expect(screen.getByText('49–64 de 118')).toBeInTheDocument();
    expect(list.querySelectorAll('.cat-equipment-row')).toHaveLength(16);
    expect(screen.getByRole('button', { name: 'Página 4' })).toHaveAttribute('aria-current', 'page');
  });

  it('resets on search and clear, searches across pages, and handles no results', async () => {
    const user = userEvent.setup();
    renderScreen();
    await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar equipo' }), 'azul');
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('32 resultados')).toBeInTheDocument();
    expect(screen.getByText('1–16 de 32')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('Equipo 17 · 128GB')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Página 1 de 8')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Buscar equipo' }), 'no existe');
    expect(screen.getByText('No hay equipos con esa búsqueda.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it.each([
    { hideWithoutStock: false }, { hideReserved: false }, { minBattery: 80 },
    { showPrice: false }, { priceCurrency: 'ARS' as const }, { active: false },
  ])('resets to page 1 when saved settings change: %j', async settings => {
    const user = userEvent.setup();
    const view = renderScreen();
    await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    context.publicCatalog = { ...context.publicCatalog!, ...settings };
    view.rerenderScreen();
    expect(screen.getByText('Página 1 de 8')).toBeInTheDocument();
    expect(screen.getByText('1–16 de 118')).toBeInTheDocument();
  });

  it('keeps the page after toggling visibility and refreshing items and counts', async () => {
    const user = userEvent.setup();
    context.setCatalogVisibility.mockImplementation(async (ids: string[], visible: boolean) => {
      context.publicCatalog = {
        ...context.publicCatalog!, counts: { ...context.publicCatalog!.counts, visible: 117, manual: 1 },
        items: context.publicCatalog!.items.map(item => ids.includes(item.id) ? { ...item, catalogVisible: visible, reason: visible ? null : 'Oculto a mano' } : item),
      };
    });
    renderScreen();
    const list = await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ ...new DOMRect(), top: -100 });
    const scrollIntoView = vi.fn();
    Object.defineProperty(list, 'scrollIntoView', { value: scrollIntoView });
    const toggle = screen.getByRole('switch', { name: 'Visible en catálogo: Equipo 17 128GB' });
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(context.setCatalogVisibility).toHaveBeenCalledWith(['17'], false);
    expect(screen.getByText('Página 2 de 8')).toBeInTheDocument();
    expect(screen.getByText('17–32 de 118')).toBeInTheDocument();
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText('Página 2 de 8')).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('clamps the current page after items are removed', async () => {
    const user = userEvent.setup();
    const view = renderScreen();
    await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    context.publicCatalog = manyItems(34);
    view.rerenderScreen();
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(screen.getByText('33–34 de 34')).toBeInTheDocument();
    expect(screen.getByText('Equipo 33 · 128GB')).toBeInTheDocument();
  });

  it('preserves individual selection and shows the count on other pages', async () => {
    const user = userEvent.setup();
    renderScreen();
    await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 1 128GB' }));
    expect(screen.getByRole('checkbox', { name: 'Seleccionar todos (118)' })).toBePartiallyChecked();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    expect(screen.getByText('1 en otras páginas')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 17 128GB' }));
    expect(screen.getByText('2 seleccionados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 1' }));
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 1 128GB' })).toBeChecked();
    expect(screen.getByText('1 en otras páginas')).toBeInTheDocument();
  });

  it('selects all filtered results across pages and sends all IDs to the bulk action', async () => {
    const user = userEvent.setup();
    renderScreen();
    await equipmentList();
    await user.type(screen.getByRole('textbox', { name: 'Buscar equipo' }), 'azul');
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos (32)' }));
    expect(screen.getByText('32 seleccionados')).toBeInTheDocument();
    expect(screen.getByText('16 en otras páginas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 32 128GB' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar todos (32)' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(context.setCatalogVisibility).toHaveBeenCalledWith(Array.from({ length: 32 }, (_, i) => String(i + 1)), false);
    await waitFor(() => expect(screen.getByText('0 seleccionados')).toBeInTheDocument());
    expect(screen.getByText('17–32 de 32')).toBeInTheDocument();
  });

  it('deselects all pages and keeps selection when a bulk save fails', async () => {
    const user = userEvent.setup();
    renderScreen();
    await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos (118)' }));
    expect(screen.getByText('118 seleccionados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    expect(screen.getByText('112 en otras páginas')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos (118)' }));
    expect(screen.getByText('0 seleccionados')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos (118)' }));
    context.setCatalogVisibility.mockRejectedValueOnce(new Error('No se pudo guardar'));
    await user.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByText('118 seleccionados')).toBeInTheDocument();
    expect(screen.getByText('Página 8 de 8')).toBeInTheDocument();
  });

  it('selects and deselects filtered results without dropping selections outside the search', async () => {
    const user = userEvent.setup();
    renderScreen();
    await equipmentList();
    await user.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 118 128GB' }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar equipo' }), 'azul');
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos (32)' }));
    expect(screen.getByText('33 seleccionados')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todos (32)' }));
    expect(screen.getByText('1 seleccionado')).toBeInTheDocument();
    expect(screen.getByText('1 en otras páginas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    await user.click(screen.getByRole('button', { name: 'Página 8' }));
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Equipo 118 128GB' })).toBeChecked();
  });

  it.each([
    { top: -100, viewportTop: 0, scroll: true },
    { top: 20, viewportTop: 72, scroll: true },
    { top: 100, viewportTop: 72, scroll: false },
    { top: 900, viewportTop: 0, scroll: true },
  ])('scrolls smoothly only when the list top is outside its viewport: %j', async ({ top, viewportTop, scroll }) => {
    const user = userEvent.setup();
    renderScreen();
    const list = await equipmentList();
    const stage = screen.getByTestId('catalog-screen').parentElement!;
    stage.classList.add('stage');
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ ...new DOMRect(), top: viewportTop, bottom: 800 });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ ...new DOMRect(), top });
    const scrollIntoView = vi.fn();
    Object.defineProperty(list, 'scrollIntoView', { value: scrollIntoView });
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    if (scroll) expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    else expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('paginates the mobile Equipos tab and preserves the page when switching tabs', async () => {
    const media = window.matchMedia('(max-width: 760px)');
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...media, media: query, matches: query.includes('760') }));
    const user = userEvent.setup();
    renderScreen();
    await screen.findByRole('button', { name: 'Equipos' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Equipos' }));
    const list = await equipmentList();
    expect(list.querySelectorAll('.cat-equipment-row')).toHaveLength(16);
    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    await user.click(screen.getByRole('button', { name: 'Resumen' }));
    await user.click(screen.getByRole('button', { name: 'Equipos' }));
    expect(screen.getByText('17–32 de 118')).toBeInTheDocument();
  });
});

describe('catalog rules permissions', () => {
  const originalMatchMedia = window.matchMedia;
  beforeEach(() => { window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
  afterEach(() => { context.appSession.membership.role = 'OWNER'; window.matchMedia = originalMatchMedia; });
  it.each(['STAFF', 'MANAGER', 'OWNER'])('shows the correct controls and save payload for %s', async role => {
    context.publicCatalog = catalog();
    context.appSession.membership.role = role;
    context.loadPublicCatalog.mockResolvedValue(context.publicCatalog);
    context.savePublicCatalog.mockReset();
    context.savePublicCatalog.mockResolvedValue(undefined);
    renderScreen();
    await userEvent.click(await screen.findByRole('button', { name: 'Reglas y precio' }));
    const sheet = screen.getByRole('dialog', { name: 'Reglas y precio' });
    for (const label of ['Regenerar link', 'Desactivar catálogo']) {
      expect(Boolean(within(sheet).queryByRole('button', { name: label }))).toBe(role === 'OWNER');
    }
    expect(Boolean(within(sheet).queryByRole('switch', { name: 'Catálogo activo' }))).toBe(role === 'OWNER');
    await userEvent.click(within(sheet).getByRole('switch', { name: 'Ocultar reservados' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(context.savePublicCatalog).toHaveBeenCalledOnce());
    const payload = context.savePublicCatalog.mock.calls[0][0];
    expect(payload).toMatchObject({ hideReserved: false, hideWithoutStock: true, minBattery: null, showPrice: true, priceCurrency: 'USD', logoUrl: null, hours: null });
    if (role === 'OWNER') expect(payload.active).toBe(true);
    else expect(payload).not.toHaveProperty('active');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
