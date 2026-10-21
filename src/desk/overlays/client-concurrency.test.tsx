import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../../types';
import { DeskProvider } from '../ui';
import { ClientForm } from './client';

const state = vi.hoisted(() => ({ clients: [] as Client[], updateClient: vi.fn(), addClient: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => state }));
const initial: Client = { id: 'client', name: 'Original', dni: '123', phone: '111', email: '', instagram: '', totalSpent: 200, pendingBalance: 100, balanceCurrency: 'ARS', lastPurchaseDate: 'N/A' };
const run = async (action: () => Promise<unknown>) => { await action(); };
function form() {
  return <DeskProvider value={{ tab: 'clients', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><ClientForm id="client" run={run} busy={false} error={null} /></DeskProvider>;
}
beforeEach(() => { state.clients = [{ ...initial }]; state.updateClient.mockResolvedValue(undefined); });

describe('client form concurrent changes #461', () => {
  it.each([390, 1440])('sends only edited contact fields after a concurrent collection at %s px', async width => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width, writable: true });
    const { rerender } = render(form());
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Renamed' } });
    state.clients = [{ ...initial, phone: '222', pendingBalance: 70, totalSpent: 300 }];
    rerender(form());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateClient).toHaveBeenCalledWith({ id: 'client', name: 'Renamed' }));
  });
  it('preserves explicit clearing without resending unchanged contact fields', async () => {
    const { rerender } = render(form());
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '' } });
    state.clients = [{ ...initial, name: 'Concurrent rename' }];
    rerender(form());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateClient).toHaveBeenCalledWith({ id: 'client', phone: '' }));
  });
  it('keeps an explicitly edited balance and its currency in the patch', async () => {
    render(form());
    fireEvent.change(screen.getByLabelText('Saldo pendiente'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(state.updateClient).toHaveBeenCalledWith({ id: 'client', pendingBalance: 50, balanceCurrency: 'ARS' }));
  });
});
