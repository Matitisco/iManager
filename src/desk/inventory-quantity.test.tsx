import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { InventoryScreen } from './screens/InventoryScreen';
import { DeskProvider } from './ui';
import type { Overlay } from './types';

const mocks = vi.hoisted(() => ({
  inventory: [] as Product[], addProduct: vi.fn(), updateProduct: vi.fn(),
  close: vi.fn(), open: vi.fn(), toast: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({ inventory: mocks.inventory, addProduct: mocks.addProduct, updateProduct: mocks.updateProduct }),
}));

const item: Product = {
  id: 'device-1', imei: '123456789012345', model: 'iPhone 13', capacity: '128GB', color: 'Azul',
  condition: 'USADO', grade: 'A', batteryHealth: '87%', cost: 100, price: 200,
  status: 'DISPONIBLE', quantity: 5, customFields: { notes: 'Con caja' },
};
const desk = { tab: 'inventory' as const, go: vi.fn(), open: mocks.open, close: mocks.close, toast: mocks.toast, isStaff: false };

function renderOverlay(overlay: Overlay) {
  return render(<DeskProvider value={desk}><DeskOverlays overlay={overlay} /></DeskProvider>);
}

async function fillNewItem() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Modelo'), 'iPhone 14');
  await user.type(screen.getByLabelText('Precio de venta'), '300');
  return user;
}

beforeEach(() => {
  mocks.inventory = [];
  mocks.addProduct.mockReset().mockResolvedValue(undefined);
  mocks.updateProduct.mockReset().mockResolvedValue(undefined);
});

describe('hi-fi inventory quantity', () => {
  it('starts at one and sends that quantity when creating a device', async () => {
    renderOverlay({ type: 'new-eq' });
    expect(screen.getByLabelText('Cantidad')).toHaveValue(1);
    const user = await fillNewItem();
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(mocks.addProduct).toHaveBeenCalledWith(expect.objectContaining({ model: 'iPhone 14', price: 300, quantity: 1 }));
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
  });

  it('sends an edited quantity on creation', async () => {
    renderOverlay({ type: 'new-eq' });
    const user = await fillNewItem();
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(mocks.addProduct).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
  });

  it('loads the stored quantity and preserves other fields when editing', async () => {
    mocks.inventory = [item];
    renderOverlay({ type: 'edit-eq', id: item.id });
    expect(screen.getByLabelText('Cantidad')).toHaveValue(5);
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '7' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(mocks.updateProduct).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, quantity: 7, cost: 100, customFields: item.customFields }));
  });

  it.each(['', '0', '-1', '1.5', '2147483648'])('rejects invalid quantity %j before persistence', async (quantity) => {
    mocks.inventory = [item];
    renderOverlay({ type: 'edit-eq', id: item.id });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: quantity } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByText('Ingresá una cantidad válida (entero mayor o igual a 1)')).toBeVisible();
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('keeps the edited quantity and the form open after a persistence error', async () => {
    mocks.inventory = [item];
    mocks.updateProduct.mockRejectedValue(new Error('No se pudo guardar la cantidad'));
    renderOverlay({ type: 'edit-eq', id: item.id });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '9' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('No se pudo guardar la cantidad')).toBeVisible();
    expect(screen.getByLabelText('Cantidad')).toHaveValue(9);
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('displays a quantity column with a fallback of one for older responses', () => {
    mocks.inventory = [item, { ...item, id: 'legacy', model: 'iPhone 12', quantity: undefined }];
    render(<DeskProvider value={desk}><InventoryScreen /></DeskProvider>);
    expect(screen.getByRole('columnheader', { name: 'Cantidad' })).toBeVisible();
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getAllByRole('cell')[3]).toHaveTextContent('5');
    expect(within(rows[2]).getAllByRole('cell')[3]).toHaveTextContent('1');
  });

  it('shows the quantity in the device detail', () => {
    mocks.inventory = [item];
    renderOverlay({ type: 'eq', id: item.id });
    expect(screen.getByText('Cantidad').parentElement).toHaveTextContent('Cantidad5');
  });

  it('edits a device from an older API response with an initial quantity of one', () => {
    mocks.inventory = [{ ...item, quantity: undefined }];
    renderOverlay({ type: 'edit-eq', id: item.id });
    expect(screen.getByLabelText('Cantidad')).toHaveValue(1);
  });
});
