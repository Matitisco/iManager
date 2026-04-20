import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientForm } from './ClientForm';

const mockAppContext = vi.hoisted(() => ({
  addClient: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => mockAppContext,
}));

describe('ClientForm', () => {
  beforeEach(() => {
    mockAppContext.addClient.mockReset();
  });

  it('validates required fields before submitting', async () => {
    const user = userEvent.setup();
    render(<ClientForm onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('DNI / ID'), '   ');
    await user.type(screen.getByLabelText('Nombre Completo'), '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar Cliente' }));

    expect(await screen.findByText(/dni.*nombre/i)).toBeInTheDocument();
    expect(mockAppContext.addClient).not.toHaveBeenCalled();
  });

  it('trims data and closes after a successful creation', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockAppContext.addClient.mockResolvedValue({ id: 'client-1' });

    render(<ClientForm onClose={onClose} />);

    await user.type(screen.getByLabelText('DNI / ID'), ' 12345678 ');
    await user.type(screen.getByLabelText('Nombre Completo'), ' Juan Perez ');
    await user.click(screen.getByRole('button', { name: 'Guardar Cliente' }));

    await waitFor(() => {
      expect(mockAppContext.addClient).toHaveBeenCalledWith({
        dni: '12345678',
        name: 'Juan Perez',
        email: '',
        phone: '',
        lastPurchaseDate: 'N/A',
        totalSpent: 0,
        pendingBalance: 0,
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
