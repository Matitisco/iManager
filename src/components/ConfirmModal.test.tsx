import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('confirms, waits for async completion and then closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen
        title="Eliminar cliente"
        message="Esta acciÃ³n no se puede deshacer."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces async errors without closing the modal', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('No se pudo borrar'));
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen
        title="Eliminar cliente"
        message="Esta acciÃ³n no se puede deshacer."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('No se pudo borrar')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
