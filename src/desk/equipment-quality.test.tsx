import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { DeskOverlays } from './DeskOverlays';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[],
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  appSession: { membership: { role: 'OWNER' as const, sections: ['inventory'] } },
}));

vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'eq-1',
    imei: '',
    model: 'iPhone 13',
    capacity: '128GB',
    color: 'Azul',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: 200,
    status: 'DISPONIBLE',
    ...overrides,
  };
}

function renderOverlay(overlay: Parameters<typeof DeskOverlays>[0]['overlay']) {
  return render(
    <DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <DeskOverlays overlay={overlay} />
    </DeskProvider>,
  );
}

describe('equipment quality', () => {
  beforeEach(() => {
    ctx.inventory = [];
    ctx.addProduct.mockReset();
    ctx.addProduct.mockResolvedValue({ id: 'created' });
    ctx.updateProduct.mockReset();
    ctx.updateProduct.mockResolvedValue(undefined);
  });

  it('keeps the equipment status primary with direct edit and archive buttons', () => {
    ctx.inventory = [product()];
    renderOverlay({ type: 'eq', id: 'eq-1' });
    const dialog = screen.getByRole('dialog', { name: 'iPhone 13 · 128GB' });
    expect(within(dialog).getByRole('button', { name: 'Historial' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(dialog).queryByText(/Ocultar historial|Ver historial|Ver todo|Sin movimientos recientes/)).not.toBeInTheDocument();
    const footer = dialog.querySelector('.sheet-foot') as HTMLElement;
    expect(within(footer).getByRole('button', { name: 'Guardar estado' })).toHaveClass('sheet-primary');
    expect(within(footer).getByRole('button', { name: 'Editar' })).toHaveClass('btn2', 's');
    expect(within(footer).getByRole('button', { name: 'Archivar' })).toHaveClass('btn2', 's');
    expect(footer.querySelector('.sheet-action-menu')).toBeNull();
    expect(within(footer).queryByRole('button', { name: 'Vender' })).not.toBeInTheDocument();
  });

  it('offers quality only for used devices, explains each grade, and clears it for new ones', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'new-eq' });

    expect(screen.queryByRole('group', { name: 'Calidad' })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Ej. iPhone 13'), 'iPhone 13');
    await user.type(screen.getByPlaceholderText('A definir'), '150000');
    await user.click(screen.getByRole('button', { name: 'Usado' }));

    const quality = screen.getByRole('group', { name: 'Calidad' });
    await user.click(screen.getByRole('button', { name: 'Qué significa cada calidad' }));
    expect(screen.getByText(/Como nuevo/)).toBeVisible();
    expect(screen.getByText(/microrayones/)).toBeVisible();
    expect(screen.getByText(/Con detalles/)).toBeVisible();
    expect(quality.querySelector('[title*="Muy bueno"]')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: (name) => name === 'A+' }));
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({
      condition: 'USADO',
      grade: 'A+',
    })));

    ctx.addProduct.mockClear();
    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    expect(screen.queryByRole('group', { name: 'Calidad' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({
      condition: 'NUEVO',
      grade: '',
      status: 'DISPONIBLE',
    })));
  });

  it('saves a purchase cost and starts the device as available', async () => {
    const user = userEvent.setup();
    renderOverlay({ type: 'new-eq' });
    await user.type(screen.getByPlaceholderText('Ej. iPhone 13'), 'iPhone 13');
    await user.type(screen.getByPlaceholderText('A definir'), '650000');
    await user.type(screen.getByLabelText('Costo'), '400000');
    expect(screen.getByRole('button', { name: 'Disponible' })).toHaveClass('on');
    await user.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(ctx.addProduct).toHaveBeenCalledWith(expect.objectContaining({
      cost: 400000,
      price: 650000,
      status: 'DISPONIBLE',
    })));
  });

  it('keeps an optional used grade and shows it on the equipment record', async () => {
    const user = userEvent.setup();
    ctx.inventory = [product()];
    const detail = renderOverlay({ type: 'eq', id: 'eq-1' });
    expect(screen.getByText('Calidad').closest('.kv')).toHaveTextContent('A');
    detail.unmount();

    renderOverlay({ type: 'edit-eq', id: 'eq-1' });
    expect(screen.getByRole('button', { name: (name) => name === 'A' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: (name) => name === 'A' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(ctx.updateProduct).toHaveBeenCalledWith(expect.objectContaining({
      condition: 'USADO',
      grade: '',
    })));
  });
});
