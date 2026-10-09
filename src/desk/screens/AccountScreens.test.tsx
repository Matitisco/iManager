import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '../../services/members-api';
import { DeskProvider } from '../ui';
import { SettingsScreen } from './AccountScreens';

const membersApi = vi.hoisted(() => ({
  listMembers: vi.fn(async () => [] as TeamMember[]),
  updateMemberSections: vi.fn(),
}));

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
  reloadSession: vi.fn(async () => undefined),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => membersApi);
vi.mock('../../services/invitations-api', () => ({ listInvitations: vi.fn(async () => []) }));

function renderSettings() {
  return render(
    <DeskProvider value={{ tab: 'settings', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
      <SettingsScreen />
    </DeskProvider>,
  );
}

describe('Settings store contact', () => {
  beforeEach(() => {
    open.mockClear();
    membersApi.listMembers.mockResolvedValue([]);
    membersApi.updateMemberSections.mockReset();
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

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'm2',
    userId: 'u2',
    role: 'STAFF',
    isDefault: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    sections: ['dashboard', 'sales'],
    user: { id: 'u2', displayName: 'Luis', email: 'luis@test.com', avatarUrl: null },
    ...overrides,
  };
}

describe('Member permissions', () => {
  beforeEach(() => {
    membersApi.updateMemberSections.mockReset();
    context.reloadSession.mockClear();
  });

  it('opens a member, keeps the previous access on cancel and stays open when save fails', async () => {
    const user = userEvent.setup();
    membersApi.listMembers.mockResolvedValue([member()]);
    membersApi.updateMemberSections.mockRejectedValue(new Error('No se pudo guardar'));
    renderSettings();

    await user.click(await screen.findByRole('button', { name: /Luis/ }));
    expect(screen.getByRole('heading', { name: 'Permisos' })).toBeInTheDocument();
    expect(screen.getByText(/luis@test.com/)).toBeInTheDocument();
    expect(screen.getByText(/Empleado/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Dashboard' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Inventario' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).not.toBeChecked();

    await user.click(screen.getByRole('switch', { name: 'Inventario' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(membersApi.updateMemberSections).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Luis/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Luis/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar permisos' }));
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permisos' })).toBeInTheDocument();
  });

  it('keeps the owner locked to every section', async () => {
    membersApi.listMembers.mockResolvedValue([member({ role: 'OWNER', sections: null, user: { id: 'u', displayName: 'Ana', email: 'ana@test.com', avatarUrl: null } })]);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /Propietario/ }));
    expect(screen.getByText('El propietario conserva el acceso a todas las secciones.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Reportes' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Guardar permisos' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Reportes' })).toBeChecked());
  });

  it('saves an explicit sensitive-action grant for a manager', async () => {
    const user = userEvent.setup();
    membersApi.listMembers.mockResolvedValue([member({
      role: 'MANAGER',
      sections: null,
      user: { id: 'u3', displayName: 'Socio', email: 'socio@test.com', avatarUrl: null },
    })]);
    membersApi.updateMemberSections.mockResolvedValue(member({ role: 'MANAGER', sensitiveAccess: false }));
    renderSettings();

    await user.click(await screen.findByRole('button', { name: /Socio/ }));
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Acciones sensibles' }));
    await user.click(screen.getByRole('button', { name: 'Guardar permisos' }));
    await waitFor(() => expect(membersApi.updateMemberSections).toHaveBeenCalledWith(
      context.user,
      's',
      'm2',
      expect.any(Array),
      false,
    ));
  });
});
