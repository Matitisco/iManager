import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import type { Overlay } from '../types';
import { DeskOverlays } from '../DeskOverlays';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';

const context = vi.hoisted(() => ({
  user: { uid: 'owner' },
  inventory: [] as Product[],
  appSession: { store: { name: 'Tienda Centro' } },
  operationDrafts: [] as unknown[],
  operationNotifications: [] as unknown[],
  reloadInventory: vi.fn(async () => undefined),
  reloadSales: vi.fn(async () => undefined),
  reloadClients: vi.fn(async () => undefined),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function item(): Product {
  return {
    id: '1',
    imei: '350000000000010',
    model: 'iPhone 13',
    capacity: '128 GB',
    color: 'Medianoche',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '89%',
    cost: 400,
    price: 650000,
    status: 'DISPONIBLE',
  };
}

function installPhone() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: String(query).includes('760'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return () => { window.matchMedia = original; };
}

function InventoryDesk() {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  return (
    <DeskProvider value={{
      tab: 'inventory',
      go: () => undefined,
      open: (next) => setOverlay(next),
      openRecord: () => undefined,
      close: () => setOverlay(null),
      toast: () => undefined,
      isStaff: false,
      canManageSensitive: true,
    }}>
      <InventoryScreen />
      <DeskOverlays overlay={overlay} />
    </DeskProvider>
  );
}

describe('Escape en inventario', () => {
  afterEach(() => {
    context.inventory = [];
  });

  it('cierra el importador y el menú de clic derecho en escritorio', async () => {
    context.inventory = [item()];
    const user = userEvent.setup();
    render(<InventoryDesk />);

    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(screen.getByRole('dialog', { name: 'Importar equipos' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Importar equipos' })).not.toBeInTheDocument();

    const row = screen.getByText('iPhone 13 · 128 GB').closest('tr') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 48, clientY: 120 });
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();

    fireEvent.contextMenu(row, { clientX: 48, clientY: 120 });
    fireEvent.mouseDown(document.querySelector('.ctxov') as HTMLElement);
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('cierra el importador y el menú de la fila en el celular', async () => {
    const restore = installPhone();
    try {
      context.inventory = [item()];
      const user = userEvent.setup();
      render(<InventoryDesk />);

      const dock = screen.getByTestId('mobile-dock');
      await user.click(within(dock).getByRole('button', { name: 'Importar' }));
      const importer = screen.getByRole('dialog', { name: 'Importar equipos' });
      expect(importer).toHaveClass('sheet');
      expect(importer.querySelector('.sheet-grab')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Importar equipos' })).not.toBeInTheDocument();

      await user.click(screen.getByTestId('row-menu'));
      expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(document.querySelector('.ctx')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();

      await user.click(screen.getByTestId('row-menu'));
      fireEvent.mouseDown(document.querySelector('.ctxov') as HTMLElement);
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
