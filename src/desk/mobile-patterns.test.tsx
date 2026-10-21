import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Actions, PageHead, PressTarget, Sheet } from './ui';

function usePhoneViewport() {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return () => { window.matchMedia = original; };
}

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
    expect(dialog.querySelector('.sheet-h')).toContainElement(screen.getByRole('button', { name: 'Cerrar' }));
    expect(dialog.querySelector('.sheet-scroll')).not.toContainElement(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('keeps an explicit footer outside the body even when its actions are wrapped', () => {
    function FooterActions() {
      return <Actions primary="Compartir comprobante" onPrimary={() => undefined} secondary="Cerrar" onSecondary={() => undefined} />;
    }
    render(
      <Sheet title="Detalle de venta" onClose={() => undefined} footer={<FooterActions />}>
        <p>Canje como parte de pago</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Detalle de venta' });
    const body = dialog.querySelector('.sheet-scroll');
    const footer = dialog.querySelector('.sheet-foot');
    expect(body).toContainElement(screen.getByText('Canje como parte de pago'));
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Compartir comprobante' }));
    expect(body).not.toContainElement(within(footer as HTMLElement).getByRole('button', { name: 'Cerrar' }));
  });

  it('shows the shared close button on a phone sheet', () => {
    const restore = usePhoneViewport();
    try {
      render(<Sheet title="Editar canje" onClose={() => undefined}><p>Detalle</p></Sheet>);
      const close = screen.getByRole('button', { name: 'Cerrar' });
      const icon = close.querySelector('svg');
      expect(close).toHaveClass('modal-x');
      expect(icon).toHaveAttribute('data-icon', 'cerrar');
      expect(icon).toHaveAttribute('width', '16');
      expect(icon).toHaveAttribute('height', '16');
    } finally {
      restore();
    }
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
