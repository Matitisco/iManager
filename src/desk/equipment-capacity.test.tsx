import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import type { CatalogOption, CatalogPayload } from '../services/catalogs-api';
import { CatalogProvider } from './catalog';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), save: vi.fn(), close: vi.fn(),
  context: {
    user: { uid: 'owner' },
    appSession: { store: { id: 'store' }, membership: { role: 'OWNER' }, onboardingRequired: false },
    inventory: [] as Product[], suppliers: [], addProduct: vi.fn(), updateProduct: vi.fn(),
  },
}));
vi.mock('../context/AppContext', () => ({ useAppContext: () => mocks.context }));
vi.mock('../services/catalogs-api', () => ({ fetchCatalogs: mocks.fetch, saveCatalog: mocks.save }));

const product = (capacity: string, id = capacity): Product => ({
  id, model: 'iPhone 13', capacity, color: 'Azul', imei: '', condition: 'NUEVO', grade: '',
  batteryHealth: '', price: 100, cost: 0, currency: 'ARS', status: 'DISPONIBLE',
});
const option = (value: string): CatalogOption => ({
  id: value, kind: 'INVENTORY_CAPACITY', value, label: value, color: null, isSystem: false, sortOrder: 0, count: 1,
});
const payload = (values = ['64GB', '128GB', '256GB', '512GB']): CatalogPayload => ({
  meta: {} as CatalogPayload['meta'], options: values.map(option),
});

async function setup(id?: string, withCatalog = true) {
  const form = <DeskOverlays overlay={id ? { type: 'edit-eq', id } : { type: 'new-eq' }} />;
  render(<DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: mocks.close, toast: vi.fn(), isStaff: false }}>
    {withCatalog ? <CatalogProvider>{form}</CatalogProvider> : form}
  </DeskProvider>);
  if (withCatalog) await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  const dialog = screen.getByRole('dialog', { name: id ? 'Editar equipo' : 'Registrar equipo' });
  return { user: userEvent.setup(), dialog };
}

function picker(dialog: HTMLElement) {
  const label = within(dialog).getByText('Capacidad', { selector: 'label' });
  return within(label.closest('.fl')!.nextElementSibling as HTMLElement);
}

describe('equipment capacity selector regression #483.5', () => {
  beforeEach(() => {
    mocks.context.inventory = [product('128 GB'), product('128gb'), product('256 GB')];
    mocks.fetch.mockReset().mockResolvedValue(payload());
    mocks.context.addProduct.mockReset().mockResolvedValue({ id: 'created' });
    mocks.context.updateProduct.mockReset().mockResolvedValue(undefined);
    mocks.close.mockReset();
  });

  it.each([true, false])('renders one field and one choice per capacity (catalog=%s)', async withCatalog => {
    const { dialog, user } = await setup(undefined, withCatalog);
    expect(within(dialog).getAllByText('Capacidad', { selector: 'label' })).toHaveLength(1);
    const buttons = picker(dialog).getAllByRole('button').filter(button => button.classList.contains('sg'));
    expect(buttons.map(button => button.textContent)).toEqual(['64GB', '128GB', '256GB', '512GB']);
    const capacity = picker(dialog).getByRole('button', { name: '128GB' });
    await user.click(capacity);
    expect(capacity).toHaveClass('on');
    await user.click(capacity);
    expect(capacity).not.toHaveClass('on');
  });

  it('integrates catalog hydration, selection, nested editor cancellation and create payload', async () => {
    let resolve!: (data: CatalogPayload) => void;
    mocks.fetch.mockReturnValueOnce(new Promise<CatalogPayload>(done => { resolve = done; }));
    const { dialog, user } = await setup();
    await user.click(picker(dialog).getByRole('button', { name: '128GB' }));
    await act(async () => resolve(payload(['64 GB', '128 GB', '128gb', '256 GB', '512GB', '1 TB'])));
    expect(picker(dialog).getAllByRole('button', { name: /^128\s*GB$/i })).toHaveLength(1);
    expect(picker(dialog).getByRole('button', { name: '128 GB' })).toHaveClass('on');
    await user.click(picker(dialog).getByRole('button', { name: 'Editar opciones' }));
    const editor = screen.getByRole('dialog', { name: 'Capacidades' });
    await user.click(within(editor).getByRole('button', { name: 'Cancelar' }));
    expect(picker(dialog).getByRole('button', { name: '128 GB' })).toHaveClass('on');
    expect(mocks.save).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Modelo'), 'iPhone 13');
    await user.type(within(dialog).getByLabelText('Precio de venta'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(mocks.context.addProduct).toHaveBeenCalledWith(expect.objectContaining({ capacity: '128GB' })));
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('keeps a legacy selected value unchanged when editing and saves another choice once', async () => {
    const { dialog, user } = await setup('128 GB');
    const selected = picker(dialog).getByRole('button', { name: '128GB' });
    expect(picker(dialog).getAllByRole('button', { name: /^128\s*GB$/i })).toHaveLength(1);
    expect(selected).toHaveClass('on');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.context.updateProduct).toHaveBeenCalledWith(expect.objectContaining({ capacity: '128 GB' })));
    await user.click(picker(dialog).getByRole('button', { name: '256GB' }));
    expect(picker(dialog).getByRole('button', { name: '128GB' })).not.toHaveClass('on');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.context.updateProduct).toHaveBeenLastCalledWith(expect.objectContaining({ capacity: '256GB' })));
  });

  it('retains selection and the modal on persistence failure, allowing retry', async () => {
    mocks.context.updateProduct.mockRejectedValueOnce(new Error('No se pudo guardar'));
    const { dialog, user } = await setup('128 GB');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(dialog).findByText('No se pudo guardar')).toBeVisible();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(picker(dialog).getByRole('button', { name: '128GB' })).toHaveClass('on');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
  });
});
