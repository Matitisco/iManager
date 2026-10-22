import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteScreen } from './InviteScreen';
import type { UseInvitationPreviewState } from '../hooks/useInvitationPreview';

const context = vi.hoisted(() => ({ user: null as null | { uid: string }, login: vi.fn(async () => undefined) }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('./Login', () => ({ Login: ({ initialRegisterMode }: { initialRegisterMode: boolean }) => <p>{initialRegisterMode ? 'Formulario para crear cuenta' : 'Formulario para iniciar sesión'}</p> }));
const leave = vi.fn(); const accept = vi.fn(); const reload = vi.fn();
const valid: UseInvitationPreviewState = { preview: { status: 'valid', storeName: 'iPhone Club Palermo', role: 'STAFF', inviterName: 'Matías', expiresAt: '2030-10-24T12:00:00Z' }, invalid: false, error: null, isLoading: false, isRetrying: false, retryAttempt: 0, reload };
function show(state = valid, accepting = false, error = '') { return render(<InviteScreen token="token" state={state} onLeave={leave} onAccept={accept} accepting={accepting} error={error} ready />); }

describe('accept invitation', () => {
  beforeEach(() => { vi.clearAllMocks(); context.user = null; });
  it('shows the store, inviter, role, expiration and Google / register / login choices', async () => {
    show();
    expect(screen.getByRole('heading', { name: 'Sumate a iPhone Club Palermo' })).toBeInTheDocument();
    expect(screen.getByText('Matías te invitó al equipo.')).toBeInTheDocument();
    expect(screen.getByText('Empleado')).toBeInTheDocument();
    expect(screen.getByText(/La invitación vence el 24 oct/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(context.login).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta con email' }));
    expect(screen.getByText('Formulario para crear cuenta')).toBeInTheDocument();
  });
  it('opens the existing login flow while preserving the invite', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Iniciá sesión' }));
    expect(screen.getByText('Formulario para iniciar sesión')).toBeInTheDocument();
  });
  it.each(['expired', 'used', 'revoked', 'not_found'] as const)('shows the unusable link screen for %s', async reason => {
    show({ ...valid, preview: null, invalid: true, reason });
    expect(screen.getByRole('heading', { name: 'Esta invitación ya no sirve' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ir a iManager' }));
    expect(leave).toHaveBeenCalledOnce();
  });
  it('keeps a technical error recoverable and shows loading independently', async () => {
    const view = show({ ...valid, preview: null, error: 'Error de conexión' });
    expect(screen.queryByText('Esta invitación ya no sirve')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar verificación' }));
    expect(reload).toHaveBeenCalledOnce();
    view.rerender(<InviteScreen token="token" state={{ ...valid, preview: null, isLoading: true }} onLeave={leave} onAccept={accept} accepting={false} error="" ready />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status').textContent).toBe('');
  });
  it('accepts for the authenticated user and keeps a persistence error visible', async () => {
    context.user = { uid: 'new-user' };
    show(valid, false, 'No se pudo aceptar');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo aceptar');
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar invitación' }));
    expect(accept).toHaveBeenCalledOnce();
  });
});
