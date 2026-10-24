import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { desktopNav, EMPTY_PENDING } from './nav';
import { SidenavNavigation } from './sidenav-navigation';

const owner = desktopNav(null, 'OWNER');

describe('sidenav accordion', () => {
  it('opens the current route, allows all closed and uses Enter/Space without navigating', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<SidenavNavigation nav={owner} pending={EMPTY_PENDING} activeHash="#/stock/equipos" onOpen={onOpen} />);
    const stock = screen.getByRole('button', { name: 'Stock' });
    const analysis = screen.getByRole('button', { name: 'Análisis' });
    expect(stock).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Equipos' })).toHaveAttribute('aria-current', 'page');
    stock.focus();
    await user.keyboard('{Enter}');
    expect(stock).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Equipos' })).not.toBeInTheDocument();
    analysis.focus();
    await user.keyboard(' ');
    expect(analysis).toHaveAttribute('aria-expanded', 'true');
    await user.click(stock);
    expect(analysis).toHaveAttribute('aria-expanded', 'false');
    expect(stock).toHaveAttribute('aria-expanded', 'true');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('selects query-only views and reopens the active group on route changes', () => {
    const onOpen = vi.fn();
    const props = { nav: owner, pending: EMPTY_PENDING, onOpen };
    const view = render(<SidenavNavigation {...props} activeHash="#/analisis/resumen-periodico" />);
    const summary = screen.getByRole('button', { name: 'Resumen periódico' });
    expect(summary).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Reportes' })).not.toHaveAttribute('aria-current');
    fireEvent.click(summary);
    expect(onOpen).toHaveBeenCalledWith('periodicSummary', undefined);
    view.rerender(<SidenavNavigation {...props} activeHash="#/comercial/devoluciones?view=patterns" />);
    expect(screen.getByRole('button', { name: 'Análisis' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Comercial' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Fallas' })).toHaveAttribute('aria-current', 'page');
    view.rerender(<SidenavNavigation {...props} activeHash="#/cuenta/configuracion" />);
    expect(screen.getByRole('button', { name: 'Cuenta' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Comercial' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Configuración' })).toHaveAttribute('aria-current', 'page');
  });

  it('inherits employee permissions and hidden modules without exposing child views', () => {
    render(<SidenavNavigation nav={desktopNav(['clients'], 'STAFF')} pending={EMPTY_PENDING} activeHash="#/atencion/clientes" mobile onOpen={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('button', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByText('Mis comisiones')).toBeInTheDocument();
    for (const label of ['Análisis', 'Reportes', 'Resumen periódico', 'Historial', 'Fallas', 'Catálogo', 'Cajas', 'Gastos', 'Seguimientos']) {
      expect(within(nav).queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('skips collapsed destinations with Tab and keeps focus on the disclosure', async () => {
    const user = userEvent.setup();
    render(<SidenavNavigation nav={owner} pending={EMPTY_PENDING} activeHash="#/dashboard" onOpen={vi.fn()} />);
    const commercial = screen.getByRole('button', { name: 'Comercial' });
    const stock = screen.getByRole('button', { name: 'Stock' });
    commercial.focus();
    await user.tab();
    expect(stock).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(stock).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Equipos' })).toHaveFocus();
    await user.tab({ shift: true });
    await user.keyboard(' ');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Atención' })).toHaveFocus();
  });

  it.each([false, true])('has only group → destination on desktop/mobile=%s', mobile => {
    const onOpen = vi.fn();
    const props = { nav: owner, pending: EMPTY_PENDING, mobile, onOpen };
    const view = render(<SidenavNavigation {...props} activeHash="#/comercial/devoluciones" />);
    expect(screen.getByRole('button', { name: 'Devoluciones' })).toHaveAttribute('aria-current', 'page');
    expect(within(screen.getByTestId('nav-group-comercial')).getAllByRole('button').map(item => item.textContent)).toEqual(['Comercial', 'Ventas', 'Canjes', 'Devoluciones']);
    expect(screen.queryByText('Reclamos')).not.toBeInTheDocument();
    for (const panel of document.querySelectorAll('.sn-children')) {
      expect(panel.querySelector('.sn-children, .sn-detail, [aria-expanded]')).toBeNull();
      expect([...panel.children].every(item => item.tagName === 'BUTTON')).toBe(true);
    }
    view.rerender(<SidenavNavigation {...props} activeHash="#/analisis/fallas" />);
    expect(screen.getByRole('button', { name: 'Fallas' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Fallas' }));
    expect(onOpen).toHaveBeenCalledWith('patterns', undefined);
    expect(screen.getByRole('button', { name: 'Resumen periódico' }).parentElement).toBe(screen.getByRole('button', { name: 'Reportes' }).parentElement);
    view.rerender(<SidenavNavigation {...props} activeHash="#/stock/catalogo?view=items" />);
    expect(screen.getByRole('button', { name: 'Catálogo' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Resumen')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
});
