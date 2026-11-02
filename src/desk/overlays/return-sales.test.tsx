import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { ReturnForm } from './return-case';

const ctx = vi.hoisted(() => ({
  sales: [], clients: [], inventory: [], returns: [], user: { uid: 'owner' }, appSession: { store: { id: 'store' } },
  loadReturnSales: vi.fn(), createReturn: vi.fn(),
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
const close = vi.fn();
const eligible = [
  { id: 'usd', clientName: 'Mayorista', deviceLabel: 'iPhone 13', date: '30/10/2026', status: 'COMPLETADA', amountCurrency: 'USD', amount: 1500, cantidad: 3, remainingQuantity: 3 },
  { id: 'ars', clientName: 'Cliente ARS', deviceLabel: 'iPhone 14', date: '02/11/2026', status: 'COMPLETADA', amountCurrency: 'ARS', amount: 500, cantidad: 1, remainingQuantity: 1 },
];
function mount() {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'returns', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}><ReturnForm /></DeskProvider></div>);
}
beforeEach(() => { vi.clearAllMocks(); ctx.loadReturnSales.mockResolvedValue(eligible); ctx.createReturn.mockResolvedValue({ id: 'claim' }); });

it.each([false, true])('loads completed sales independently of empty global lists (phone=%s)', async phone => {
  const media = window.matchMedia;
  window.matchMedia = query => ({ matches: phone, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() });
  try {
    mount();
    await waitFor(() => expect(ctx.loadReturnSales).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('combobox', { name: 'Venta' }));
    expect(screen.getByRole('option', { name: /Cliente ARS/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /Mayorista/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Cantidad a devolver' }), { target: { value: '1' } });
    await userEvent.type(screen.getByLabelText('Motivo'), 'Falla de pantalla');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir reclamo' }));
    await waitFor(() => expect(ctx.createReturn).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'usd', cantidad: 1 })));
    expect(close).toHaveBeenCalledOnce();
  } finally { window.matchMedia = media; }
});
it('shows query errors, retries and preserves drafts on persistence failure', async () => {
  ctx.loadReturnSales.mockRejectedValueOnce(new Error('No se pudieron cargar las ventas'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las ventas');
  expect(screen.getByRole('button', { name: 'Abrir reclamo' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Venta' })).toBeEnabled());
  await userEvent.click(screen.getByRole('combobox', { name: 'Venta' }));
  await userEvent.click(screen.getByRole('option', { name: /Mayorista/ }));
  await userEvent.type(screen.getByLabelText('Motivo'), 'Falla');
  ctx.createReturn.mockRejectedValueOnce(new Error('Sin conexión'));
  await userEvent.click(screen.getByRole('button', { name: 'Abrir reclamo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar. Probá de nuevo.');
  expect(screen.getByLabelText('Motivo')).toHaveValue('Falla');
  expect(close).not.toHaveBeenCalled();
});
it('keeps submit disabled until sales finish loading and explains a real empty result', async () => {
  let finish!: (value: []) => void;
  ctx.loadReturnSales.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  mount();
  expect(screen.getByRole('button', { name: 'Abrir reclamo' })).toBeDisabled();
  finish([]);
  expect(await screen.findByText('No hay ventas con unidades disponibles para reclamar.')).toBeInTheDocument();
});
