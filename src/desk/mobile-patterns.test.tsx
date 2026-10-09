import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Actions, PageHead, PressTarget, Sheet } from './ui';

describe('mobile sheet patterns', () => {
  it('keeps the actions in a footer and the fields in the scrolling body', () => {
    render(
      <Sheet title="Registrar equipo" onClose={() => undefined}>
        <label className="fl"><span>Modelo</span><input aria-label="Modelo" /></label>
        <Actions primary="Guardar equipo" onPrimary={() => undefined} onSecondary={() => undefined} />
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Registrar equipo' });
    expect(dialog.querySelector('.sheet-scroll')).toContainElement(screen.getByLabelText('Modelo'));
    expect(dialog.querySelector('.sheet-foot')).toContainElement(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(dialog.querySelector('.sheet-foot')).toContainElement(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
  });

  it('shows the back arrow and a row menu that opens actions', async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    const onMenu = vi.fn();
    render(
      <>
        <PageHead title="Servicio técnico" subtitle="8 abiertas" back={back} />
        <PressTarget as="button" className="phone-row" onActivate={() => undefined} onMenu={onMenu}>
          <b>iPhone 13</b>
        </PressTarget>
      </>,
    );
    await user.click(screen.getByTestId('page-back'));
    expect(back).toHaveBeenCalledOnce();
    await user.click(screen.getByTestId('row-menu'));
    expect(onMenu).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Más acciones' })).toBeInTheDocument();
  });
});
