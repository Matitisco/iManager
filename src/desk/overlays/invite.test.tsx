import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteForm } from './account';
import { DeskProvider } from '../ui';
import { createInvitation } from '../../services/invitations-api';

const context = vi.hoisted(() => ({ user: { uid: 'u', getIdToken: async () => 'token' }, appSession: { membership: { role: 'MANAGER' } }, refreshGettingStarted: vi.fn() }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/invitations-api', () => ({ createInvitation: vi.fn(), listInvitations: vi.fn(), revokeInvitation: vi.fn() }));
const close = vi.fn();
function show() { render(<DeskProvider value={{ tab: 'settings', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}><InviteForm /></DeskProvider>); }

describe('link invitations', () => {
  beforeEach(() => { vi.clearAllMocks(); context.appSession.membership.role = 'MANAGER'; vi.mocked(createInvitation).mockResolvedValue({ id: 'i', token: 't', inviteUrl: 'https://imanager.test/invite/t', role: 'STAFF', createdAt: '', expiresAt: '' }); });
  it('lets a Socio invite only as Empleado, without requiring email or claiming to send it', async () => {
    show();
    expect(screen.getByText('Empleado', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('Socio', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Vendedor', { exact: true })).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('invite-send'));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith(context.user, undefined, 'STAFF', expect.objectContaining({ sections: expect.arrayContaining(['dashboard', 'clients', 'service', 'notifications']) })));
    expect(await screen.findByTestId('invite-url')).toHaveTextContent('https://imanager.test/invite/t');
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByText('Invitación enviada')).not.toBeInTheDocument();
  });
  it('lets the owner choose Socio and leaves errors in the sheet', async () => {
    context.appSession.membership.role = 'OWNER';
    vi.mocked(createInvitation).mockRejectedValue(new Error('No se pudo crear el link'));
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Socio' }));
    await userEvent.click(screen.getByTestId('invite-send'));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith(context.user, undefined, 'MANAGER', expect.any(Object)));
    expect(await screen.findByText('No se pudo crear el link')).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
  it.each(['invite-send', 'invite-copy'])('validates an invalid email before %s and recovers after editing', async (action) => {
    const user = userEvent.setup();
    show();
    const email = screen.getByRole('textbox', { name: 'Email (opcional)' });
    await user.type(email, 'QA cuenta invalido');
    await user.click(screen.getByTestId(action));
    expect(screen.getByText('Ingresá un email válido.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(createInvitation).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    await user.clear(email);
    await user.type(email, 'qa.cuenta@imanager.local');
    expect(screen.queryByText('Ingresá un email válido.')).not.toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'false');
    await user.click(screen.getByTestId(action));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith(context.user, 'qa.cuenta@imanager.local', 'STAFF', expect.any(Object)));
  });
  it('copies a link without requiring the optional email', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByTestId('invite-copy'));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith(context.user, undefined, 'STAFF', expect.any(Object)));
    expect(await screen.findByTestId('invite-url')).toHaveTextContent('https://imanager.test/invite/t');
  });
});
