import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreSwitcher } from './StoreSwitcher';

const mockContext = vi.hoisted(() => ({
  appSession: {
    store: { id: 'store-1', name: 'Casa Central' },
    membership: { role: 'OWNER' as const, isDefault: true },
    stores: [
      { id: 'store-1', name: 'Casa Central', role: 'OWNER' as const, isDefault: true },
      { id: 'store-2', name: 'Sucursal Norte', role: 'OWNER' as const, isDefault: false },
    ],
  },
  createOwnedStore: vi.fn(),
  activateStore: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockContext,
}));

describe('StoreSwitcher', () => {
  beforeEach(() => {
    mockContext.createOwnedStore.mockReset();
    mockContext.activateStore.mockReset();
    mockContext.createOwnedStore.mockResolvedValue(undefined);
    mockContext.activateStore.mockResolvedValue(undefined);
  });

  it('switches the active store and creates another one for the same user', async () => {
    const user = userEvent.setup();
    render(<StoreSwitcher />);

    await user.click(screen.getByRole('button', { name: /Casa Central/i }));
    await user.click(screen.getByRole('button', { name: /Sucursal Norte/i }));
    expect(mockContext.activateStore).toHaveBeenCalledWith('store-2');

    await user.click(screen.getByRole('button', { name: /Casa Central/i }));
    await user.type(screen.getByLabelText('Nueva tienda'), 'Sucursal Sur');
    await user.click(screen.getByRole('button', { name: 'Crear tienda' }));

    expect(mockContext.createOwnedStore).toHaveBeenCalledWith('Sucursal Sur');
  });

  it('keeps the panel open and shows the error when creating a store fails', async () => {
    const user = userEvent.setup();
    mockContext.createOwnedStore.mockRejectedValue(new Error('No se pudo crear la tienda'));
    render(<StoreSwitcher />);

    await user.click(screen.getByRole('button', { name: /Casa Central/i }));
    await user.type(screen.getByLabelText('Nueva tienda'), 'Sucursal Sur');
    await user.click(screen.getByRole('button', { name: 'Crear tienda' }));

    expect(await screen.findByText('No se pudo crear la tienda')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva tienda')).toHaveValue('Sucursal Sur');
  });
});
