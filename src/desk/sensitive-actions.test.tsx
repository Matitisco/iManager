import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[],
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  appSession: { membership: { role: 'STAFF' as const, sections: ['inventory'] } },
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

function product(): Product {
  return {
    id: 'eq-1',
    imei: '',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Negro',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: 200,
    status: 'DISPONIBLE',
    priceChangedBy: 'Ana Dueña',
    priceChangedAt: '2026-10-09T15:04:00.000Z',
  };
}

function renderEquipment(canManageSensitive: boolean) {
  ctx.inventory = [product()];
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: true, canManageSensitive }}>
      <DeskOverlays overlay={{ type: 'eq', id: 'eq-1' }} />
    </DeskProvider>,
  );
}

describe('sensitive action controls', () => {
  it('shows who changed the price on the equipment record', () => {
    renderEquipment(false);
    expect(screen.getByText('Precio cambiado por Ana Dueña el 09/10/2026 12:04')).toBeInTheDocument();
  });

  it('disables the sale price when editing without permission', () => {
    ctx.inventory = [product()];
    render(
      <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: true, canManageSensitive: false }}>
        <DeskOverlays overlay={{ type: 'edit-eq', id: 'eq-1' }} />
      </DeskProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'Precio de venta' })).toBeDisabled();
  });
});
