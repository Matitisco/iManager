import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthActionLink } from '../lib/auth-action-url';
import { AuthActionPage } from './AuthActionPage';

const verifyResetCode = vi.hoisted(() => vi.fn());
const confirmReset = vi.hoisted(() => vi.fn());
const verifyEmailCode = vi.hoisted(() => vi.fn());
const recoverEmailCode = vi.hoisted(() => vi.fn());

vi.mock('../services/auth-action', () => ({
  verifyResetCode,
  confirmReset,
  verifyEmailCode,
  recoverEmailCode,
}));

function link(overrides: Partial<AuthActionLink> = {}): AuthActionLink {
  return {
    mode: 'resetPassword',
    oobCode: 'code-1',
    apiKey: 'key',
    continueUrl: null,
    lang: 'es',
    ...overrides,
  };
}

async function readyForm() {
  expect(await screen.findByTestId('auth-action-email')).toHaveTextContent('owner@imanager.test');
}

describe('AuthActionPage', () => {
  beforeEach(() => {
    verifyResetCode.mockReset();
    confirmReset.mockReset();
    verifyEmailCode.mockReset();
    recoverEmailCode.mockReset();
    verifyResetCode.mockResolvedValue('owner@imanager.test');
    confirmReset.mockResolvedValue(undefined);
    verifyEmailCode.mockResolvedValue(undefined);
    recoverEmailCode.mockResolvedValue('restored@imanager.test');
  });

  it('shows the account email after the sdk verifies the code', async () => {
    render(<AuthActionPage link={link()} onDone={vi.fn()} />);
    await readyForm();
    expect(verifyResetCode).toHaveBeenCalledWith('code-1');
    expect(screen.getByRole('heading', { name: 'Nueva contraseña' })).toBeInTheDocument();
  });

  it('shows and hides the new password and its confirmation', async () => {
    const user = userEvent.setup();
    render(<AuthActionPage link={link()} onDone={vi.fn()} />);
    await readyForm();

    expect(screen.getByTestId('reset-password')).toHaveAttribute('type', 'password');
    expect(screen.getByTestId('reset-password-confirm')).toHaveAttribute('type', 'password');

    await user.click(screen.getByTestId('reset-password-toggle'));
    expect(screen.getByTestId('reset-password')).toHaveAttribute('type', 'text');
    expect(screen.getByTestId('reset-password-confirm')).toHaveAttribute('type', 'text');

    await user.click(screen.getByTestId('reset-password-confirm-toggle'));
    expect(screen.getByTestId('reset-password')).toHaveAttribute('type', 'password');
  });

  it('does not call the sdk when the confirmation does not match', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<AuthActionPage link={link()} onDone={onDone} />);
    await readyForm();

    await user.type(screen.getByTestId('reset-password'), 'nueva-clave-1');
    await user.type(screen.getByTestId('reset-password-confirm'), 'otra-clave-2');
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    expect(confirmReset).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not call the sdk for a short password', async () => {
    const user = userEvent.setup();
    render(<AuthActionPage link={link()} onDone={vi.fn()} />);
    await readyForm();

    await user.type(screen.getByTestId('reset-password'), '123');
    await user.type(screen.getByTestId('reset-password-confirm'), '123');
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(await screen.findByText(/al menos 6 caracteres/i)).toBeInTheDocument();
    expect(confirmReset).not.toHaveBeenCalled();
  });

  it('saves the password and asks to return to login', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<AuthActionPage link={link()} onDone={onDone} />);
    await readyForm();

    await user.type(screen.getByTestId('reset-password'), 'nueva-clave-1');
    await user.type(screen.getByTestId('reset-password-confirm'), 'nueva-clave-1');
    await user.click(screen.getByTestId('reset-password-submit'));

    await waitFor(() => expect(confirmReset).toHaveBeenCalledWith('code-1', 'nueva-clave-1'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('password'));
  });

  it.each([
    ['auth/weak-password', /demasiado débil/i],
    ['auth/network-request-failed', /revisá tu conexión/i],
  ])('shows a spanish message for %s and keeps the form', async (code, message) => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    confirmReset.mockRejectedValue({ code });
    render(<AuthActionPage link={link()} onDone={onDone} />);
    await readyForm();

    await user.type(screen.getByTestId('reset-password'), 'nueva-clave-1');
    await user.type(screen.getByTestId('reset-password-confirm'), 'nueva-clave-1');
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByTestId('reset-password-submit')).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/expired-action-code', /venció/i],
    ['auth/invalid-action-code', /ya fue usado/i],
  ])('shows a spanish message for %s before the form', async (code, message) => {
    verifyResetCode.mockRejectedValue({ code });
    render(<AuthActionPage link={link()} onDone={vi.fn()} />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByTestId('reset-password')).not.toBeInTheDocument();
  });

  it('explains a link that has no code', async () => {
    render(<AuthActionPage link={link({ oobCode: '' })} onDone={vi.fn()} />);
    expect(await screen.findByText(/no incluye un código válido/i)).toBeInTheDocument();
    expect(verifyResetCode).not.toHaveBeenCalled();
  });

  it('verifies an email address and confirms an email change', async () => {
    const { rerender } = render(<AuthActionPage link={link({ mode: 'verifyEmail' })} onDone={vi.fn()} />);
    expect(await screen.findByText(/quedó verificado/i)).toBeInTheDocument();
    expect(verifyEmailCode).toHaveBeenCalledWith('code-1');

    rerender(<AuthActionPage link={link({ mode: 'verifyAndChangeEmail', oobCode: 'change-1' })} onDone={vi.fn()} />);
    expect(await screen.findByText(/cambio de correo/i)).toBeInTheDocument();
    expect(verifyEmailCode).toHaveBeenCalledWith('change-1');
  });

  it('restores a recovered email address', async () => {
    render(<AuthActionPage link={link({ mode: 'recoverEmail' })} onDone={vi.fn()} />);
    expect(await screen.findByText(/restored@imanager.test/)).toBeInTheDocument();
    expect(recoverEmailCode).toHaveBeenCalledWith('code-1');
  });

  it('shows a clear message for modes the screen does not complete', async () => {
    render(<AuthActionPage link={link({ mode: 'signIn' })} onDone={vi.fn()} />);
    expect(await screen.findByText(/no se puede abrir en iManager/i)).toBeInTheDocument();
    expect(verifyResetCode).not.toHaveBeenCalled();
    expect(verifyEmailCode).not.toHaveBeenCalled();
    expect(recoverEmailCode).not.toHaveBeenCalled();
  });

  it('returns to login without saving when leaving the screen', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<AuthActionPage link={link()} onDone={onDone} />);
    await readyForm();
    await user.click(screen.getByTestId('auth-action-back'));
    expect(onDone).toHaveBeenCalledWith(null);
    expect(confirmReset).not.toHaveBeenCalled();
  });

  it('disables the submit button while the sdk is saving', async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    confirmReset.mockReturnValue(new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));
    render(<AuthActionPage link={link()} onDone={vi.fn()} />);
    await readyForm();

    await user.type(screen.getByTestId('reset-password'), 'nueva-clave-1');
    await user.type(screen.getByTestId('reset-password-confirm'), 'nueva-clave-1');
    await user.click(screen.getByTestId('reset-password-submit'));

    expect(screen.getByTestId('reset-password-submit')).toBeDisabled();
    expect(screen.getByTestId('reset-password-submit')).toHaveTextContent('Guardando…');

    await act(async () => resolveSave());
    await waitFor(() => expect(screen.getByTestId('reset-password-submit')).toBeEnabled());
  });
});
