import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DeskProvider } from '../ui';
import { ReturnsScreen } from './ReturnsScreen';

const context = vi.hoisted(() => ({
  user: { uid: 'user-1' },
  returns: null as Array<{ id: string }> | null,
  returnsError: '',
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

const open = vi.fn();

function desk(child: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'returns', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      {child}
    </DeskProvider>,
  );
}

describe('devoluciones', () => {
  beforeEach(() => {
    history.replaceState(null, '', '#/comercial/devoluciones');
    context.returns = null;
    context.returnsError = '';
  });
  it('muestra el esqueleto y no el vacío mientras cargan', () => {
    context.returns = null;
    desk(<ReturnsScreen />);
    expect(screen.getByTestId('returns-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('returns-empty')).not.toBeInTheDocument();
  });

  it('muestra el vacío recién cuando la lista llegó vacía', () => {
    context.returns = [];
    desk(<ReturnsScreen />);
    expect(screen.getByTestId('returns-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin reclamos', level: 2 })).toBeInTheDocument();
    expect(screen.queryByTestId('returns-loading')).not.toBeInTheDocument();
  });

  it('abre el formulario existente desde la única acción del vacío', async () => {
    context.returns = [];
    desk(<ReturnsScreen />);
    const actions = screen.getAllByRole('button', { name: 'Nuevo reclamo' });
    expect(actions).toHaveLength(1);
    await userEvent.click(actions[0]);
    expect(open).toHaveBeenCalledExactlyOnceWith({ type: 'new-return' });
  });

  it('distingue los filtros vacíos y conserva la acción para crear', async () => {
    context.returns = [];
    desk(<ReturnsScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Archivados' }));
    expect(screen.getByRole('heading', { name: 'Sin reclamos archivados' })).toBeInTheDocument();
    expect(screen.getByText('Los reclamos que archives van a aparecer acá.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activos' }));
    expect(screen.getByRole('heading', { name: 'Sin reclamos activos' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo reclamo' }));
    expect(open).toHaveBeenCalledExactlyOnceWith({ type: 'new-return' });
  });

  it('no presenta un resultado vacío exitoso cuando falla la consulta', () => {
    context.returns = [];
    context.returnsError = 'No se pudieron consultar los reclamos.';
    desk(<ReturnsScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(context.returnsError);
    expect(screen.queryByTestId('returns-empty')).not.toBeInTheDocument();
  });
});
