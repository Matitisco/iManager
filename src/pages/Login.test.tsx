import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
