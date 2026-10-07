import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';

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
  });

  it('does not show help or privacy links', () => {
    render(<Login />);

    expect(screen.queryByRole('link', { name: 'Ayuda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Privacidad' })).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${new Date().getFullYear()} iManager`))).toBeInTheDocument();
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
});
