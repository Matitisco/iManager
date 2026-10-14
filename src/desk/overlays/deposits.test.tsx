import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { CancelDeposit, DepositChoices, DepositForm, DepositReceipt } from './deposits';
import type { ClientDeposit } from '../../types';
const ctx = vi.hoisted(() => ({ clients: [{ id: 'c1', name: 'Ana' }], inventory: [], addClientDeposit: vi.fn(), cancelClientDeposit: vi.fn(), loadOperationOptions: vi.fn().mockResolvedValue({ products: [] }) }));
const desk = vi.hoisted(() => ({ open: vi.fn(), toast: vi.fn(), close: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../ui', async importOriginal => ({ ...await importOriginal<typeof import('../ui')>(), useDesk: () => desk }));
vi.mock('../exchange', () => ({ useMoney: () => ({ active: 'USD', rate: 2000 }) }));
const row: ClientDeposit = { id: 'd1', clientId: 'c1', amount: 100000.5, currency: 'ARS', exchangeRate: 1000, usdAmount: 100, method: 'EFECTIVO', status: 'ACTIVE', productId: 'p1', productLabel: 'iPhone', previousInventoryStatus: 'DISPONIBLE', saleId: null, repairId: null, appliedAmount: null, appliedCurrency: null, appliedAt: null, cancelledAt: null, createdAt: '2026-10-14T10:00:00Z' };
beforeEach(() => { ctx.addClientDeposit.mockReset(); ctx.cancelClientDeposit.mockReset(); desk.toast.mockReset(); desk.open.mockReset(); });
it('shows original receipt cents and frozen value independent of the toolbar quote', () => {
  render(<DepositReceipt row={row} />);
  expect(screen.getByText('$ 100.000,5 ARS')).toBeInTheDocument();
  expect(screen.getByText(/USD 100,00 fijos/)).toBeInTheDocument();
});
it('keeps a failed deposit sheet open with the same idempotency key for retry', async () => {
  ctx.addClientDeposit.mockRejectedValueOnce(new Error('No se pudo guardar')).mockResolvedValueOnce(row);
  render(<DepositForm clientId="c1" />);
  await userEvent.type(screen.getByLabelText('Monto de la seña'), '50,25');
  await userEvent.click(screen.getByRole('button', { name: 'Registrar seña' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar'); expect(desk.open).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Registrar seña' }));
  await waitFor(() => expect(desk.open).toHaveBeenCalledWith({ type: 'cl', id: 'c1' }));
  const first = ctx.addClientDeposit.mock.calls[0][1]; const retry = ctx.addClientDeposit.mock.calls[1][1];
  expect(first).toMatchObject({ amount: 50.25, currency: 'USD', exchangeRate: 2000, productId: null }); expect(retry.requestKey).toBe(first.requestKey);
});
it('refunds an existing credit the first time it is confirmed', async () => {
  const credit = { ...row, status: 'CREDIT' as const, productId: null, productLabel: null };
  ctx.cancelClientDeposit.mockResolvedValue({ ...credit, status: 'REFUNDED' });
  const close = vi.fn();
  render(<CancelDeposit row={credit} onClose={close} />);
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }));
  await waitFor(() => expect(ctx.cancelClientDeposit).toHaveBeenCalledExactlyOnceWith('c1', 'd1', 'REFUND'));
  expect(desk.toast).toHaveBeenCalledWith('Seña devuelta · equipo liberado');
  expect(close).toHaveBeenCalled();
});
it('does not report success when a credit balance is confirmed as credit again', async () => {
  const credit = { ...row, status: 'CREDIT' as const };
  ctx.cancelClientDeposit.mockResolvedValue(credit);
  const close = vi.fn();
  render(<CancelDeposit row={credit} onClose={close} />);
  await userEvent.click(screen.getByRole('button', { name: 'Dejar saldo a favor' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar saldo a favor' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Elegí devolver el dinero');
  expect(desk.toast).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
it('blocks dismissal and duplicate refund while saving and keeps errors visible', async () => {
  let reject!: (error: Error) => void;
  ctx.cancelClientDeposit.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
  const close = vi.fn(); render(<CancelDeposit row={row} onClose={close} />);
  await userEvent.click(screen.getByRole('button', { name: 'Devolver dinero' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar devolución' }));
  await userEvent.keyboard('{Escape}');
  expect(close).not.toHaveBeenCalled(); expect(ctx.cancelClientDeposit).toHaveBeenCalledExactlyOnceWith('c1', 'd1', 'REFUND');
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  reject(new Error('No se pudo devolver')); expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo devolver'); expect(close).not.toHaveBeenCalled();
});
it('requires the reserved device and blocks overpayment when applying receipts', () => {
  const change = vi.fn();
  const receipts = { rows: [row], error: '', loading: false, retry: vi.fn() };
  const props = { receipts, clientId: 'c1', productId: 'other', selected: [], onChange: change, currency: 'USD', rate: 2000, maximum: 500, busy: false };
  const { rerender } = render(<DepositChoices {...props} />);
  expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  rerender(<DepositChoices {...props} productId="p1" maximum={50} />); expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  rerender(<DepositChoices {...props} productId="p1" />); expect(screen.getByRole('button', { name: 'Aplicar' })).toBeEnabled();
});
