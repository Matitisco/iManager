import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NamedCatalog } from '../../types/public-catalog';
import { DeskProvider } from '../ui';
import { StoreCatalogList } from './StoreCatalogList';

const context = vi.hoisted(() => ({
  storeCatalogs: [] as NamedCatalog[],
  loadStoreCatalogs: vi.fn(), saveNamedCatalog: vi.fn(), deleteNamedCatalog: vi.fn(), regenerateNamedCatalog: vi.fn(), previewNamedCatalog: vi.fn(),
  loadPublicCatalog: vi.fn(), setCatalogVisibility: vi.fn(), setNamedCatalogVisibility: vi.fn(),
  appSession: { membership: { role: 'OWNER', sections: null as string[] | null }, store: { name: 'Tienda de prueba', phone: '1155551234', currency: 'USD' } },
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
const toast = vi.fn();
function catalog(id = 'default', name = 'Clientes finales'): NamedCatalog {
  return { id, name, itemVisibility: id === 'default' ? 'GLOBAL' : 'OWN', isDefault: id === 'default', slug: `tienda-${id}`, active: true, hideWithoutStock: true, hideReserved: true, minBattery: null, showPrice: true, priceCurrency: 'ORIGINAL', logoUrl: null, hours: null, priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: 0,
    counts: { visible: 1, rules: 0, manual: 0, available: 1 },
    items: [{ id: 'item-1', model: 'Equipo de prueba', capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', batteryHealth: '90%', price: 300, currency: 'USD', catalogVisible: true, reason: null, manualPrice: null, manualCurrency: 'USD' }],
  };
}
function renderList() {
  return render(<DeskProvider value={{ tab: 'publicCatalog', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast, isStaff: false }}><StoreCatalogList /></DeskProvider>);
}
async function edit(name = 'Clientes finales') {
  const row = await screen.findByRole('article', { name });
  await userEvent.click(within(row).getByRole('button', { name: 'Editar ›' }));
  return screen.getByRole('dialog', { name });
}
beforeEach(() => {
  vi.clearAllMocks();
  context.storeCatalogs = [catalog(), catalog('resellers', 'Revendedores')];
  context.appSession.membership = { role: 'OWNER', sections: null };
  context.loadStoreCatalogs.mockResolvedValue(context.storeCatalogs);
  context.saveNamedCatalog.mockResolvedValue(catalog());
  context.previewNamedCatalog.mockResolvedValue({ store: { name: 'Tienda de prueba', phone: null, address: null, logoUrl: null, hours: null }, active: true, showPrice: true, priceCurrency: 'USD', items: context.storeCatalogs[0].items });
});
afterEach(() => vi.restoreAllMocks());
describe('multiple catalogs list and editor', () => {
  it('shows each name, link, rule summary and count, and copies the selected link', async () => {
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByRole('heading', { name: 'Catálogos' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    const row = screen.getByRole('article', { name: 'Revendedores' });
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/c/tienda-resellers');
    expect(row).toHaveTextContent('Oculta sin stock · Oculta reservados');
    expect(row).toHaveTextContent('1en la lista');
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(within(row).getByRole('button', { name: 'Copiar link' }));
    expect(copy).toHaveBeenCalledWith(`${window.location.origin}/c/tienda-resellers`);
    expect(toast).toHaveBeenCalledWith('Link copiado');
  });
  it('toggles only the chosen catalog and reports a failed persistence', async () => {
    renderList();
    await userEvent.click(await screen.findByRole('switch', { name: 'Catálogo activo: Revendedores' }));
    expect(context.saveNamedCatalog).toHaveBeenCalledWith('resellers', { active: false });
    context.saveNamedCatalog.mockRejectedValueOnce(new Error('No se pudo guardar'));
    await userEvent.click(screen.getByRole('switch', { name: 'Catálogo activo: Clientes finales' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(screen.getByRole('switch', { name: 'Catálogo activo: Clientes finales' })).toHaveAttribute('aria-checked', 'true');
  });
  it('creates with list price and zero adjustment, requiring a name', async () => {
    const user = userEvent.setup(); renderList();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo catálogo' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Nuevo catálogo' }));
    const sheet = screen.getByRole('dialog', { name: 'Nuevo catálogo' });
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    expect(context.saveNamedCatalog).not.toHaveBeenCalled();
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Poné un nombre');
    await user.type(within(sheet).getByRole('textbox', { name: 'Nombre' }), 'Mayoristas');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    expect(context.saveNamedCatalog).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'Mayoristas', priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: 0 }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('edits the chosen catalog, supports negative adjustment and keeps errors in the sheet', async () => {
    const user = userEvent.setup(); renderList(); const sheet = await edit('Revendedores');
    expect(within(sheet).getByRole('textbox', { name: 'Nombre' })).toHaveValue('Revendedores');
    const adjustment = within(sheet).getByRole('spinbutton', { name: 'Ajuste sobre el precio' });
    await user.clear(adjustment); await user.type(adjustment, '-10');
    context.saveNamedCatalog.mockRejectedValueOnce(new Error('No se pudo guardar'));
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    expect(context.saveNamedCatalog).toHaveBeenCalledWith('resellers', expect.objectContaining({ priceAdjustPercent: -10 }));
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('No se pudo guardar');
    expect(sheet).toBeVisible();
  });
  it('selects manual pricing and saves per-item prices with currency', async () => {
    const user = userEvent.setup(); renderList(); const sheet = await edit('Revendedores');
    await user.click(within(sheet).getByRole('combobox', { name: 'Regla de precio' }));
    await user.click(screen.getByRole('option', { name: 'Precio por equipo' }));
    expect(within(sheet).queryByRole('spinbutton', { name: 'Ajuste sobre el precio' })).not.toBeInTheDocument();
    expect(sheet).toHaveTextContent('Si dejás un precio vacío, se usa el precio de lista');
    await user.type(within(sheet).getByRole('spinbutton', { name: 'Precio manual de Equipo de prueba 128GB Negro' }), '275.50');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    expect(context.saveNamedCatalog).toHaveBeenCalledWith('resellers', expect.objectContaining({ priceRuleMode: 'MANUAL', manualPrices: [{ inventoryItemId: 'item-1', price: 275.5, currency: 'USD' }] }));
  });
  it('hides private cost configuration and publication controls for a manager without financial access', async () => {
    context.appSession.membership = { role: 'MANAGER', sections: ['publicCatalog'] };
    context.storeCatalogs[1] = { ...catalog('resellers', 'Revendedores'), priceRuleMode: null, priceAdjustPercent: null };
    const user = userEvent.setup(); renderList(); const sheet = await edit('Revendedores');
    expect(screen.queryByRole('switch', { name: /Catálogo activo/ })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Borrar catálogo' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Regenerar link' })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('spinbutton', { name: 'Ajuste sobre el precio' })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('combobox', { name: 'Regla de precio' }));
    expect(screen.queryByRole('option', { name: '% sobre el costo' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    const payload = context.saveNamedCatalog.mock.calls[0][1];
    expect(payload).not.toHaveProperty('active'); expect(payload).not.toHaveProperty('priceRuleMode'); expect(payload).not.toHaveProperty('priceAdjustPercent');
  });
  it('supports the cost rule when canSeeFinancials grants access', async () => {
    const user = userEvent.setup(); renderList(); const sheet = await edit();
    await user.click(within(sheet).getByRole('combobox', { name: 'Regla de precio' }));
    await user.click(screen.getByRole('option', { name: '% sobre el costo' }));
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
    expect(context.saveNamedCatalog).toHaveBeenCalledWith('default', expect.objectContaining({ priceRuleMode: 'COST_PERCENT' }));
  });
  it('never offers deleting the default and confirms deleting a secondary catalog', async () => {
    const user = userEvent.setup(); renderList(); const sheet = await edit();
    expect(within(sheet).queryByRole('button', { name: 'Borrar catálogo' })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Cancelar' }));
    const secondary = await edit('Revendedores');
    await user.click(within(secondary).getByRole('button', { name: 'Borrar catálogo' }));
    const confirm = screen.getByRole('dialog', { name: '¿Borrar el catálogo?' });
    await user.click(within(confirm).getByRole('button', { name: 'Borrar catálogo' }));
    expect(context.deleteNamedCatalog).toHaveBeenCalledWith('resellers');
  });
  it('previews unsaved rules using the catalog currently being edited', async () => {
    const user = userEvent.setup(); renderList(); const sheet = await edit('Revendedores');
    await user.click(within(sheet).getByText('Vista previa', { selector: 'summary' }));
    await waitFor(() => expect(context.previewNamedCatalog).toHaveBeenCalledWith('resellers', expect.objectContaining({ name: 'Revendedores' }), expect.any(AbortSignal)));
    const adjustment = within(sheet).getByRole('spinbutton', { name: 'Ajuste sobre el precio' });
    await user.clear(adjustment); await user.type(adjustment, '-15');
    await waitFor(() => expect(context.previewNamedCatalog).toHaveBeenLastCalledWith('resellers', expect.objectContaining({ priceAdjustPercent: -15 }), expect.any(AbortSignal)));
    expect(context.saveNamedCatalog).not.toHaveBeenCalled();
  });
  it('places the new catalog action below the list on mobile and opens a full screen editor with back', async () => {
    const media = window.matchMedia('(max-width:760px)');
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ ...media, media: query, matches: query.includes('760') }));
    renderList();
    const add = screen.getByRole('button', { name: 'Nuevo catálogo' });
    await waitFor(() => expect(add).toBeEnabled());
    expect(add).toHaveClass('cat-new-mobile');
    const list = screen.getByRole('article', { name: 'Revendedores' });
    expect(list.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(add);
    const sheet = screen.getByRole('dialog', { name: 'Nuevo catálogo' });
    expect(within(sheet).getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });
  it('shows a load failure and does not replace it with an empty successful state', async () => {
    context.storeCatalogs = []; context.loadStoreCatalogs.mockRejectedValueOnce(new Error('No se pudieron cargar los catálogos'));
    renderList();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los catálogos');
  });
});

it('shows GLOBAL shared visibility note and routes saved toggles to the selected catalog', async () => {
  const user = userEvent.setup(); renderList();
  const sheet = await edit();
  expect(sheet).toHaveTextContent('La visibilidad de este catálogo es compartida con los otros catálogos antiguos.');
  await user.click(within(sheet).getByText('Equipos y visibilidad', { selector: 'summary' }));
  await user.click(within(sheet).getByRole('switch', { name: 'Visible en catálogo: Equipo de prueba 128GB' }));
  expect(context.setNamedCatalogVisibility).toHaveBeenCalledWith('default', ['item-1'], false);
  expect(context.setCatalogVisibility).not.toHaveBeenCalled();
});
it('new draft shows all eligible items visible, lets you hide before saving and previews those ids', async () => {
  const user = userEvent.setup();
  context.storeCatalogs[0].items[0] = { ...context.storeCatalogs[0].items[0], catalogVisible: false, reason: 'Oculto a mano' };
  renderList();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo catálogo' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Nuevo catálogo' }));
  const sheet = screen.getByRole('dialog', { name: 'Nuevo catálogo' });
  const toggle = within(sheet).getByRole('switch', { name: 'Visible en catálogo: Equipo de prueba 128GB' });
  expect(toggle).toBeChecked();
  await user.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(sheet).toHaveTextContent('Oculto a mano');
  expect(context.setNamedCatalogVisibility).not.toHaveBeenCalled();
  expect(context.setCatalogVisibility).not.toHaveBeenCalled();
  await user.type(within(sheet).getByRole('textbox', { name: 'Nombre' }), 'Nueva lista');
  await user.click(within(sheet).getByText('Vista previa', { selector: 'summary' }));
  await waitFor(() => expect(context.previewNamedCatalog).toHaveBeenLastCalledWith(null, expect.objectContaining({ hiddenItemIds: ['item-1'] }), expect.any(AbortSignal)));
  await user.click(within(sheet).getByRole('button', { name: 'Guardar' }));
  expect(context.saveNamedCatalog).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'Nueva lista', hiddenItemIds: ['item-1'] }));
});
it('OWN saved toggles stay scoped and failures keep the item visible with an error', async () => {
  const user = userEvent.setup(); renderList(); const sheet = await edit('Revendedores');
  expect(sheet).not.toHaveTextContent('compartida con los otros catálogos antiguos');
  await user.click(within(sheet).getByText('Equipos y visibilidad', { selector: 'summary' }));
  context.setNamedCatalogVisibility.mockRejectedValueOnce(new Error('No se pudo ocultar'));
  const toggle = within(sheet).getByRole('switch', { name: 'Visible en catálogo: Equipo de prueba 128GB' });
  await user.click(toggle);
  expect(context.setNamedCatalogVisibility).toHaveBeenCalledWith('resellers', ['item-1'], false);
  expect(await within(sheet).findByRole('alert')).toHaveTextContent('No se pudo ocultar');
  expect(toggle).toBeChecked();
});
