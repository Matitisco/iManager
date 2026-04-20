import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders its contents only when open', () => {
    const { rerender } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Nuevo cliente">
        <div>Contenido modal</div>
      </Modal>
    );

    expect(screen.queryByText('Contenido modal')).not.toBeInTheDocument();

    rerender(
      <Modal isOpen onClose={vi.fn()} title="Nuevo cliente">
        <div>Contenido modal</div>
      </Modal>
    );

    expect(screen.getByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument();
    expect(screen.getByText('Contenido modal')).toBeInTheDocument();
  });

  it('closes when the user clicks the backdrop or close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = render(
      <Modal isOpen onClose={onClose} title="Editar">
        <div>Formulario</div>
      </Modal>
    );

    const backdrop = document.body.querySelector('.absolute.inset-0');
    if (!backdrop) {
      throw new Error('Backdrop not found');
    }

    await user.click(backdrop);
    await user.click(screen.getByRole('button'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
