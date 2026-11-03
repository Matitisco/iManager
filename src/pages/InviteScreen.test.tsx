import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteScreen } from './InviteScreen';
import type { UseInvitationPreviewState } from '../hooks/useInvitationPreview';

const context = vi.hoisted(() => ({ user: null as null | { uid: string; email?: string; emailVerified?: boolean }, login: vi.fn(async () => undefined), logout: vi.fn(async () => undefined) }));
const sendVerification = vi.hoisted(() => vi.fn(async (_uid: string) => undefined));
vi.mock('../services/auth-action', () => ({ sendInvitationEmailVerification: sendVerification }));
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
    const view = show({ ...valid, preview: null, error: 'No se pudo verificar la invitación' });
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

  it('offers account switching without leaving or accepting the invitation', async () => {
    context.user = { uid: 'other-user', email: 'other@example.com', emailVerified: true };
    show(valid, false, 'Esta invitación es para otro email');
    expect(screen.getByRole('alert')).toHaveTextContent('Esta invitación es para otro email');
    expect(screen.getByText('Tu cuenta: other@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar otro email' }));
    expect(context.logout).toHaveBeenCalledOnce();
    expect(leave).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
  });

  it('sends verification only on request and keeps the invitation ready for retry', async () => {
    context.user = { uid: 'new-user', email: 'invitee@example.com', emailVerified: false };
    show();
    expect(sendVerification).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar verificación de email' }));
    expect(sendVerification).toHaveBeenCalledWith('new-user');
    expect(screen.getByRole('status')).toHaveTextContent('Abrilo y después volvé a aceptar esta invitación.');
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar invitación' }));
    expect(accept).toHaveBeenCalledOnce();
    expect(leave).not.toHaveBeenCalled();
  });

  it('keeps a verification failure visible and allows another attempt', async () => {
    context.user = { uid: 'new-user', emailVerified: false };
    sendVerification.mockRejectedValueOnce(new Error('No se pudo enviar la verificación. Probá de nuevo.'));
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar verificación de email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo enviar la verificación');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar verificación de email' })).toBeEnabled();
  });
});

 it('suppresses the entire connection load error panel without replacement copy', () => {
  show({ ...valid, preview: null, error: 'No hay conexión. Revisá tu internet y probá de nuevo.' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/No hay conexión|No pudimos verificar/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reintentar verificación' })).not.toBeInTheDocument();
});
