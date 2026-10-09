import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';

const sendPasswordResetEmail = vi.hoisted(() => vi.fn());

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail,
}));

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
}));

const mockAppContext = vi.hoisted(() => ({
  login: vi.fn(),
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
}));

const mockInvitationState = vi.hoisted(() => ({
  preview: null,
  invalid: false,
  error: null,
  isLoading: false,
  isRetrying: false,
  retryAttempt: 0,
  reload: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockAppContext,
}));

vi.mock('../hooks/useInvitationPreview', () => ({
  useInvitationPreview: () => mockInvitationState,
}));

function pendingLogin() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Login', () => {
  beforeEach(() => {
    mockAppContext.login.mockReset();
    mockAppContext.loginWithEmail.mockReset();
    mockAppContext.registerWithEmail.mockReset();
    mockInvitationState.preview = null;
    mockInvitationState.invalid = false;
    mockInvitationState.error = null;
    mockInvitationState.isLoading = false;
    mockInvitationState.isRetrying = false;
    sendPasswordResetEmail.mockReset();
  });

  it('submits email login through the app context', async () => {
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'owner@imanager.test' } });
    fireEvent.change(screen.getByPlaceholderText(/^contrase/i), { target: { value: 'secret123' } });
    fireEvent.submit(screen.getByRole('button', { name: /iniciar sesi/i }).closest('form')!);

    await waitFor(() => {
      expect(mockAppContext.loginWithEmail).toHaveBeenCalledWith('owner@imanager.test', 'secret123');
    });
  });

  it('validates password confirmation before trying to register', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole('button', { name: /^crear cuenta$/i }));
    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'new@imanager.test' } });
    fireEvent.change(screen.getByPlaceholderText(/^contrase/i), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByPlaceholderText(/confirmar/i), { target: { value: 'different456' } });
    fireEvent.submit(screen.getByRole('button', { name: /^crear cuenta$/i }).closest('form')!);

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    expect(mockAppContext.registerWithEmail).not.toHaveBeenCalled();
  });

  it('renders invitation preview details and maps google auth errors', async () => {
    const user = userEvent.setup();
    mockInvitationState.preview = { storeName: 'Casa Central', role: 'MANAGER' };
    mockAppContext.login.mockRejectedValue({ code: 'auth/popup-blocked' });

    render(<Login inviteToken="invite-123" />);

    expect(screen.getByText('Te invitaron a una tienda')).toBeInTheDocument();
    expect(screen.getByText(/Casa Central/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Continuar con Google/i }));

    expect(await screen.findByText(/permit.*popups/i)).toBeInTheDocument();
  });

  it.each(['login', 'register'])('allows retrying Google on focus before Firebase settles in %s mode', async (mode) => {
    const first = pendingLogin();
    const retry = pendingLogin();
    mockAppContext.login.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    render(<Login />);

    if (mode === 'register') {
      fireEvent.click(screen.getByRole('button', { name: /^crear cuenta$/i }));
    }

    const googleButton = screen.getByTestId('login-google');
    fireEvent.click(googleButton);
    expect(googleButton).toBeDisabled();

    fireEvent.focus(window);
    expect(googleButton).toBeEnabled();
    expect(screen.getByTestId('login-submit')).toBeEnabled();

    fireEvent.click(googleButton);
    expect(mockAppContext.login).toHaveBeenCalledTimes(2);
    expect(googleButton).toBeDisabled();

    await act(async () => first.reject({ code: 'auth/popup-closed-by-user' }));
    expect(googleButton).toBeDisabled();
    expect(screen.queryByText(/cerraste la ventana/i)).not.toBeInTheDocument();

    await act(async () => retry.resolve());
    expect(googleButton).toBeEnabled();
  });

  it('recovers when the tab becomes visible while Google is still pending', async () => {
    const attempt = pendingLogin();
    mockAppContext.login.mockReturnValue(attempt.promise);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<Login />);

    const googleButton = screen.getByTestId('login-google');
    fireEvent.click(googleButton);
    fireEvent(document, new Event('visibilitychange'));
    expect(googleButton).toBeDisabled();

    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    expect(googleButton).toBeEnabled();
    visibility.mockRestore();

    await act(async () => attempt.resolve());
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('returns to normal without an error for %s', async (code) => {
    mockAppContext.login.mockRejectedValue({ code });
    render(<Login />);
    fireEvent.click(screen.getByTestId('login-google'));

    await waitFor(() => expect(screen.getByTestId('login-google')).toBeEnabled());
    expect(screen.queryByText(/cerraste la ventana|ya hay un intento/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^crear cuenta$/i }));
    expect(screen.getByPlaceholderText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it.each(['resolve', 'reject'])('ignores an old attempt that later %s while a retry is pending', async (result) => {
    const first = pendingLogin();
    const retry = pendingLogin();
    mockAppContext.login.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    render(<Login />);

    fireEvent.click(screen.getByTestId('login-google'));
    fireEvent.focus(window);
    fireEvent.click(screen.getByTestId('login-google'));

    await act(async () => {
      if (result === 'resolve') first.resolve();
      else first.reject({ code: 'auth/network-request-failed' });
    });
    expect(screen.getByTestId('login-google')).toBeDisabled();
    expect(screen.queryByText(/revisá tu conexión/i)).not.toBeInTheDocument();

    await act(async () => retry.reject({ code: 'auth/popup-blocked' }));
    expect(screen.getByTestId('login-google')).toBeEnabled();
    expect(screen.getByText(/permit.*popups/i)).toBeInTheDocument();
  });

  it('keeps the email submission pending when the window regains focus', async () => {
    const attempt = pendingLogin();
    mockAppContext.loginWithEmail.mockReturnValue(attempt.promise);
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'owner@imanager.test' } });
    fireEvent.change(screen.getByPlaceholderText(/^contrase/i), { target: { value: 'secret123' } });
    fireEvent.submit(screen.getByTestId('login-submit').closest('form')!);
    fireEvent.focus(window);

    expect(screen.getByTestId('login-submit')).toBeDisabled();
    await act(async () => attempt.resolve());
    expect(screen.getByTestId('login-submit')).toBeEnabled();
  });

  it('removes focus and visibility listeners when the form unmounts', async () => {
    const attempt = pendingLogin();
    mockAppContext.login.mockReturnValue(attempt.promise);
    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<Login />);

    fireEvent.click(screen.getByTestId('login-google'));
    const focusListener = addWindowListener.mock.calls.find(([event]) => event === 'focus')?.[1];
    const visibilityListener = addDocumentListener.mock.calls.find(([event]) => event === 'visibilitychange')?.[1];
    expect(focusListener).toBeDefined();
    expect(visibilityListener).toBeDefined();

    unmount();
    expect(removeWindowListener).toHaveBeenCalledWith('focus', focusListener);
    expect(removeDocumentListener).toHaveBeenCalledWith('visibilitychange', visibilityListener);
    await act(async () => attempt.reject({ code: 'auth/popup-closed-by-user' }));

    addWindowListener.mockRestore();
    removeWindowListener.mockRestore();
    addDocumentListener.mockRestore();
    removeDocumentListener.mockRestore();
  });

  it('omits dead help and privacy links and keeps password recovery', () => {
    const { container } = render(<Login />);

    expect(screen.queryByRole('link', { name: /^ayuda$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^privacidad$/i })).not.toBeInTheDocument();
    expect(container.querySelector('a[href="#"]')).toBeNull();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} iManager`))).toBeInTheDocument();
    expect(screen.getByTestId('forgot-password')).toHaveTextContent('¿Olvidaste tu contraseña?');
  });

  it('hides password recovery while creating an account', () => {
    render(<Login />);
    expect(screen.getByTestId('forgot-password')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^crear cuenta$/i }));
    expect(screen.queryByTestId('forgot-password')).not.toBeInTheDocument();
  });

  it('opens a desk reset form with the email already typed', () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: '  owner@imanager.test  ' } });
    fireEvent.click(screen.getByTestId('forgot-password'));

    const dialog = screen.getByRole('dialog', { name: /olvidaste tu contraseña/i });
    expect(dialog).toHaveClass('sheet', 'compact');
    expect(dialog.closest('.desk-app')).toHaveClass('reset-host');
    expect(screen.getByTestId('password-reset-email')).toHaveValue('owner@imanager.test');
  });

  it('sends a reset email and shows a generic confirmation', async () => {
    sendPasswordResetEmail.mockResolvedValue(undefined);
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'owner@imanager.test' } });
    fireEvent.click(screen.getByTestId('forgot-password'));
    fireEvent.change(screen.getByTestId('password-reset-email'), { target: { value: '  other@imanager.test ' } });
    fireEvent.submit(screen.getByTestId('password-reset-submit').closest('form')!);

    expect(await screen.findByTestId('password-reset-success')).toHaveTextContent(
      'Si el email está registrado, te mandamos un link para cambiar la contraseña',
    );
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ currentUser: null }, 'other@imanager.test');
    expect(screen.queryByText(/no existe una cuenta/i)).not.toBeInTheDocument();
  });

  it('treats a missing account the same as a sent reset email', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    render(<Login />);
    fireEvent.click(screen.getByTestId('forgot-password'));
    fireEvent.change(screen.getByTestId('password-reset-email'), { target: { value: 'missing@imanager.test' } });
    fireEvent.submit(screen.getByTestId('password-reset-submit').closest('form')!);

    expect(await screen.findByTestId('password-reset-success')).toHaveTextContent(
      'Si el email está registrado, te mandamos un link para cambiar la contraseña',
    );
    expect(screen.queryByText(/no existe|no está registrado/i)).not.toBeInTheDocument();
  });

  it.each([
    ['auth/network-request-failed', /revisá tu conexión/i],
    ['auth/too-many-requests', /demasiados intentos/i],
    ['auth/invalid-email', /no es válido/i],
  ])('shows a spanish message for %s and keeps the form open', async (code, message) => {
    sendPasswordResetEmail.mockRejectedValue({ code });
    render(<Login />);
    fireEvent.click(screen.getByTestId('forgot-password'));
    fireEvent.change(screen.getByTestId('password-reset-email'), { target: { value: 'owner@imanager.test' } });
    fireEvent.submit(screen.getByTestId('password-reset-submit').closest('form')!);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByTestId('password-reset-success')).not.toBeInTheDocument();
    expect(screen.getByTestId('password-reset-submit')).toBeEnabled();
  });

  it('disables the reset button while firebase is sending', async () => {
    let resolveReset!: () => void;
    sendPasswordResetEmail.mockReturnValue(new Promise<void>((resolve) => {
      resolveReset = resolve;
    }));
    render(<Login />);
    fireEvent.click(screen.getByTestId('forgot-password'));
    fireEvent.change(screen.getByTestId('password-reset-email'), { target: { value: 'owner@imanager.test' } });
    fireEvent.submit(screen.getByTestId('password-reset-submit').closest('form')!);

    expect(screen.getByTestId('password-reset-submit')).toBeDisabled();
    expect(screen.getByTestId('password-reset-submit')).toHaveTextContent('Enviando…');
    expect(screen.getByTestId('password-reset-email')).toBeDisabled();

    await act(async () => resolveReset());
    expect(await screen.findByTestId('password-reset-success')).toBeInTheDocument();
  });
});
