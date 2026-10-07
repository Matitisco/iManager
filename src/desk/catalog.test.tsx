import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogKind, CatalogOption, CatalogPayload } from '../services/catalogs-api';
import { CatalogEditor, CatalogProvider, useCatalogs } from './catalog';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), save: vi.fn(),
  context: { user: { uid: 'owner' }, appSession: { store: { id: 'store' }, membership: { role: 'OWNER' }, onboardingRequired: false } },
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => mocks.context }));
vi.mock('../services/catalogs-api', () => ({ fetchCatalogs: mocks.fetch, saveCatalog: mocks.save }));

const kinds: CatalogKind[] = ['INVENTORY_STATUS', 'INVENTORY_CAPACITY', 'INVENTORY_CONDITION', 'SALE_STATUS', 'TRADE_IN_STATUS', 'CLIENT_TAG'];
const meta = Object.fromEntries(kinds.map(kind => [kind, { title: kind, add: 'Agregar estado', noun: ['equipo', 'equipos'] }])) as CatalogPayload['meta'];
function option(value: string, count = 0, isSystem = false): CatalogOption {
  return { id: value, kind: 'INVENTORY_STATUS', value, label: value, color: '#25A66A', isSystem, sortOrder: 0, count };
}
let payload: CatalogPayload;
function ReadyEditor({ onClose }: { onClose: () => void }) {
  const catalogs = useCatalogs();
  return catalogs?.ready ? <CatalogEditor kind="INVENTORY_STATUS" onClose={onClose} /> : null;
}
async function setup() {
  const onClose = vi.fn();
  const view = render(<CatalogProvider><ReadyEditor onClose={onClose} /></CatalogProvider>);
  await screen.findByRole('dialog');
  return { ...view, onClose, user: userEvent.setup() };
}
const row = (label: string) => screen.getByRole('textbox', { name: `Nombre de este estado ${label}` }).closest('.stx-row') as HTMLElement;

describe('Catalog editor drafts and persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    payload = { meta, options: [option('Revisión', 2), option('Reservado'), option('Disponible', 0, true)] };
    mocks.fetch.mockResolvedValue(payload);
    mocks.save.mockResolvedValue(payload);
  });

  it('focuses an added draft and preserves it through delete and undo without touching system states', async () => {
    const { user } = await setup();
    expect(within(row('Disponible')).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Agregar estado' }));
    const added = screen.getAllByRole('textbox').at(-1)!;
    expect(added).toHaveFocus();
    await user.type(added, 'Diagnóstico');
    await user.click(within(row('Diagnóstico')).getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText('Se elimina al guardar.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Diagnóstico')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByDisplayValue('Diagnóstico')).toBeEnabled();
    expect(screen.queryByText('Se elimina al guardar.')).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('marks blank and duplicate names and rejects deleting the last option before requesting a save', async () => {
    payload.options = [option('Único')];
    const { user, onClose } = await setup();
    await user.click(screen.getByRole('button', { name: '+ Agregar estado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Hay uno sin nombre.');
    const added = screen.getAllByRole('textbox').at(-1)!;
    expect(added.closest('.stx-row')).toHaveClass('bad');
    await user.type(added, '  ÚNICO  ');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('«ÚNICO» está repetido.');
    for (const button of screen.getAllByRole('button', { name: 'Eliminar' })) await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tiene que quedar al menos uno.');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses a live destination when the selected reassignment target is also deleted', async () => {
    const { user } = await setup();
    await user.click(within(row('Revisión')).getByRole('button', { name: 'Eliminar' }));
    await user.selectOptions(screen.getByRole('combobox'), 'Reservado');
    await user.click(within(row('Reservado')).getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByRole('combobox')).toHaveValue('Disponible');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(mocks.context.user, 'INVENTORY_STATUS', {
      options: [{ value: 'Disponible', label: 'Disponible', color: '#25A66A' }],
      deletions: [{ value: 'Revisión', reassignTo: 'Disponible' }, { value: 'Reservado', reassignTo: 'Disponible' }],
    }));
  });

  it('keeps pending and failed saves open, permits retry and closes only after persistence succeeds', async () => {
    let rejectSave!: (reason: Error) => void;
    mocks.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    const { user, onClose, container } = await setup();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled();
    expect(screen.getAllByRole('textbox').every(input => input.hasAttribute('disabled'))).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(container.querySelector('.ov')!);
    expect(onClose).not.toHaveBeenCalled();
    rejectSave(new Error('Falló PostgreSQL'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló PostgreSQL');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it('handles Escape in the editor without closing the underlying sheet', async () => {
    const parentClose = vi.fn();
    window.addEventListener('keydown', parentClose);
    try {
      const { onClose } = await setup();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
      expect(parentClose).not.toHaveBeenCalled();
    } finally { window.removeEventListener('keydown', parentClose); }
  });
});
