import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { ReturnsScreen } from './ReturnsScreen';

const context = vi.hoisted(() => ({
  user: { uid: 'user-1' },
  returns: null as Array<{ id: string }> | null,
  returnsError: '',
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

function desk(child: ReactNode) {
  return render(
    <DeskProvider value={{ tab: 'returns', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      {child}
    </DeskProvider>,
  );
}

describe('devoluciones', () => {
  beforeEach(() => history.replaceState(null, '', '#/comercial/devoluciones'));
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
    expect(screen.getByRole('heading', { name: 'Todavía no cargaste reclamos.', level: 2 })).toBeInTheDocument();
    expect(screen.queryByTestId('returns-loading')).not.toBeInTheDocument();
  });
});
