import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { SettingsScreen } from './AccountScreens';

const open = vi.fn();
const context = vi.hoisted(() => ({
  appSession: {
    user: { id: 'u', displayName: 'Ana', email: 'ana@test.com' },
    store: {
      id: 's',
      name: 'Casa',
      phone: '2614001122' as string | null,
      email: 'hola@tienda.test' as string | null,
      instagram: 'mitienda' as string | null,
    },
    membership: { role: 'OWNER' as const },
  },
  user: { getIdToken: async () => 'token' },
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => ({ listMembers: vi.fn(async () => []) }));
vi.mock('../../services/invitations-api', () => ({ listInvitations: vi.fn(async () => []) }));

function renderSettings() {
  return render(
    <DeskProvider value={{ tab: 'settings', go: vi.fn(), open, close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <SettingsScreen />
    </DeskProvider>,
  );
}

describe('Settings store contact', () => {
  beforeEach(() => {
    open.mockClear();
    context.appSession.store.phone = '2614001122';
    context.appSession.store.email = 'hola@tienda.test';
    context.appSession.store.instagram = 'mitienda';
  });

  it('shows the saved contact details and opens the store editor', async () => {
    renderSettings();
    expect(screen.getByText('2614001122 · hola@tienda.test · @mitienda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Casa/ }));
    expect(open).toHaveBeenCalledWith({ type: 'store' });
  });

  it('shows an empty contact state before the details are loaded', () => {
    context.appSession.store.phone = null;
    context.appSession.store.email = null;
    context.appSession.store.instagram = null;
    renderSettings();
    expect(screen.getByText('Sin datos de contacto')).toBeInTheDocument();
  });
});