import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

const mockAppContext = vi.hoisted(() => ({
  appSession: {
    user: {
      id: 'user-1',
      displayName: 'Mati Test',
      email: 'mati@imanager.test',
      avatarUrl: '',
    },
  },
  completeOnboarding: vi.fn(),
  acceptStoreInvitation: vi.fn(),
  logout: vi.fn(),
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

describe('Onboarding', () => {
  beforeEach(() => {
    mockAppContext.completeOnboarding.mockReset();
    mockAppContext.acceptStoreInvitation.mockReset();
    mockAppContext.logout.mockReset();
    mockInvitationState.preview = null;
    mockInvitationState.invalid = false;
    mockInvitationState.error = null;
    mockInvitationState.isLoading = false;
    mockInvitationState.isRetrying = false;
    mockInvitationState.reload.mockReset();
  });

  it('does not render placeholder hash links', () => {
    const { container } = render(<Onboarding />);
    expect(container.querySelector('a[href="#"]')).toBeNull();
  });

  it('creates a store from the onboarding form', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const input = screen.getByLabelText('Nombre de la tienda');
    await user.clear(input);
    await user.type(input, 'Sucursal Norte');
    await user.click(screen.getByRole('button', { name: 'Crear tienda y continuar' }));

    await waitFor(() => {
      expect(mockAppContext.completeOnboarding).toHaveBeenCalledWith('Sucursal Norte');
    });
  });

  it('accepts a valid invitation and notifies the caller', async () => {
    const user = userEvent.setup();
    const onInviteAccepted = vi.fn();
    mockInvitationState.preview = { storeName: 'Casa Central', role: 'OWNER' };

    render(<Onboarding inviteToken="invite-1" onInviteAccepted={onInviteAccepted} />);

    await user.click(screen.getByRole('button', { name: /Unirme a Casa Central/i }));

    await waitFor(() => {
      expect(mockAppContext.acceptStoreInvitation).toHaveBeenCalledWith('invite-1');
      expect(onInviteAccepted).toHaveBeenCalledTimes(1);
    });
  });

  it('lets the user retry invitation verification on recoverable errors', async () => {
    const user = userEvent.setup();
    mockInvitationState.error = 'El backend tardó en responder';

    render(<Onboarding inviteToken="invite-2" />);

    expect(screen.getByText('El backend tardó en responder')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));

    expect(mockInvitationState.reload).toHaveBeenCalledTimes(1);
  });
});
