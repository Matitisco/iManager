import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../types';
import { DeskOverlays } from '../DeskOverlays';
import type { Overlay } from '../types';
import { DeskProvider } from '../ui';

const ctx = vi.hoisted(() => ({
  inventory: [] as Product[], sales: [], repairOrders: [], suppliers: [],
  appSession: { membership: { role: 'OWNER' } },
  updateProduct: vi.fn(), deleteProduct: vi.fn(),
}));
const layout = vi.hoisted(() => ({ phone: false }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../section-notices', async original => ({ ...await original<typeof import('../section-notices')>(), usePhoneLayout: () => layout.phone }));
const open = vi.fn(), close = vi.fn(), toast = vi.fn();
const detail: Overlay = { type: 'eq', id: 'eq' };
const menu: Overlay = { type: 'ctx', kind: 'eq', id: 'eq', label: 'iPhone 13 · 128GB', x: 100, y: 100 };

function Harness({ initial = detail, canManageSensitive = true, navigate = true }: { initial?: Overlay; canManageSensitive?: boolean; navigate?: boolean }) {
  const [overlay, setOverlay] = useState<Overlay | null>(initial);
  return <div className="desk-app"><DeskProvider value={{
    tab: 'inventory', go: vi.fn(), openRecord: vi.fn(), isStaff: !canManageSensitive, canManageSensitive, toast,
    open: next => { open(next); if (navigate) setOverlay(next); },
    close: () => { close(); setOverlay(null); },
  }}><DeskOverlays overlay={overlay} /></DeskProvider></div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx.inventory = [{ id: 'eq', model: 'iPhone 13', capacity: '128GB', imei: '', color: 'Negro', condition: 'USADO', batteryHealth: '90%', grade: 'A', price: 500, cost: 200, status: 'DISPONIBLE' }];
  ctx.updateProduct.mockResolvedValue(undefined);
  ctx.deleteProduct.mockResolvedValue(undefined);
});

describe.each([false, true])('equipment actions (phone=%s)', phone => {
  beforeEach(() => { layout.phone = phone; });

  it('replaces the detail with the existing edit form without saving the status draft', async () => {
    render(<Harness />);
    const parent = screen.getByRole('dialog');
    const footer = parent.querySelector<HTMLElement>('.sheet-foot')!;
    expect(within(footer).getAllByRole('button').map(button => button.textContent)).toEqual(['Editar', 'Archivar', 'Guardar estado']);
    expect(within(footer).getByRole('button', { name: 'Editar' })).toHaveClass('btn2', 's');
    expect(within(footer).getByRole('button', { name: 'Archivar' })).toHaveClass('btn2', 's');
    expect(screen.queryByText('Más acciones')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'En revisión' }));
    await userEvent.click(within(footer).getByRole('button', { name: 'Editar' }));
    expect(open).toHaveBeenCalledWith({ type: 'edit-eq', id: 'eq' });
    expect(parent).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar equipo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Modelo')).toHaveValue('iPhone 13');
    expect(screen.getByRole('button', { name: 'Disponible' })).toHaveClass('on');
    expect(ctx.updateProduct).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Guardar estado' })).not.toBeInTheDocument();
  });

  it('keeps the header X as the close action', async () => {
    render(<Harness />);
    const closeButton = screen.getByRole('button', { name: 'Cerrar' });
    expect(closeButton).toHaveClass('modal-x');
    await userEvent.click(closeButton);
    expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the existing archive confirmation and cancellation leaves the product untouched', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(open).toHaveBeenCalledWith({ type: 'del', kind: 'eq', id: 'eq', label: 'iPhone 13 · 128GB' });
    expect(screen.getByRole('dialog', { name: 'Archivar equipo' })).toBeInTheDocument();
    expect(ctx.deleteProduct).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(ctx.deleteProduct).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('archives only after confirmation, passing the chosen reason', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicado' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(ctx.deleteProduct).toHaveBeenCalledWith('eq', 'Duplicado'));
    expect(toast).toHaveBeenCalledWith('Archivado');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the confirmation open with a visible error when archiving fails', async () => {
    ctx.deleteProduct.mockRejectedValueOnce(new Error('No se pudo archivar.'));
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
    expect(screen.getByRole('dialog', { name: 'Archivar equipo' })).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps editing available without archive permission and locks price in the existing form', async () => {
    render(<Harness canManageSensitive={false} />);
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('textbox', { name: 'Precio de venta' })).toBeDisabled();
  });

  it('does not offer archiving an already archived product', () => {
    ctx.inventory[0].archivedAt = '2026-10-29T10:00:00Z';
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
  });

  it('preserves status saving and disables navigation while the request is pending', async () => {
    let resolve!: () => void;
    ctx.updateProduct.mockReturnValueOnce(new Promise<void>(yes => { resolve = yes; }));
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'En revisión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
    expect(ctx.updateProduct).toHaveBeenCalledWith({ ...ctx.inventory[0], status: 'EN_REVISION' });
    for (const name of ['Editar', 'Archivar', 'Cerrar', 'Guardando…']) expect(screen.getByRole('button', { name })).toBeDisabled();
    await act(async () => resolve());
    expect(toast).toHaveBeenCalledWith('Estado actualizado');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar estado' })).toBeEnabled();
  });

  it('keeps editing and archiving in the row menu and exposes Vender with the existing preset', async () => {
    render(<Harness initial={menu} navigate={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'edit-eq', id: 'eq' });
    await userEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'del', kind: 'eq', id: 'eq', label: 'iPhone 13 · 128GB' });
    await userEvent.click(screen.getByRole('button', { name: 'Vender' }));
    expect(open).toHaveBeenLastCalledWith({ type: 'new-sale', productId: 'eq', source: 'inventory' });
  });

  it.each(['VENDIDO', 'RESERVADO', 'EN_REVISION', 'archived', 'missing'])('does not offer Vender for %s equipment', state => {
    if (state === 'archived') ctx.inventory[0].archivedAt = '2026-10-29T10:00:00Z';
    else if (state === 'missing') ctx.inventory = [];
    else ctx.inventory[0].status = state;
    render(<Harness initial={menu} navigate={false} />);
    expect(screen.queryByRole('button', { name: 'Vender' })).not.toBeInTheDocument();
  });
});
