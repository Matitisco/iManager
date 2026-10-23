import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '../../services/members-api';
import { listInvitations } from '../../services/invitations-api';
import { DeskProvider } from '../ui';
import { SettingsScreen } from './AccountScreens';

const membersApi = vi.hoisted(() => ({
  listMembers: vi.fn(async () => [] as TeamMember[]),
  updateMemberSections: vi.fn(),
  removeMember: vi.fn(),
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
    membership: { role: 'OWNER' as 'OWNER' | 'MANAGER' | 'STAFF' },
  },
  user: { getIdToken: async () => 'token' },
  reloadSession: vi.fn(async () => undefined),
}));

vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/members-api', () => membersApi);
vi.mock('../../services/invitations-api', () => ({ listInvitations: vi.fn(async () => []) }));

beforeEach(() => {
  history.replaceState(null, '', '#/config');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

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

  it('el dueño abre el reporte automático y un encargado no lo ve', async () => {
    const view = renderSettings();
    expect(screen.getByRole('button', { name: /Reporte automático/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reporte automático/ }));
    expect(open).toHaveBeenCalledWith({ type: 'periodic-report' });
    view.unmount();
    context.appSession.membership.role = 'MANAGER';
    renderSettings();
    expect(screen.queryByRole('button', { name: /Reporte automático/ })).not.toBeInTheDocument();
    context.appSession.membership.role = 'OWNER';
  });

  it('shows the saved contact details and opens the store editor', async () => {
    renderSettings();
    expect(screen.getByText('2614001122 · hola@tienda.test · @mitienda')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-instagram-notice')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Casa/ }));
    expect(open).toHaveBeenCalledWith({ type: 'store' });
  });

  it('shows an empty contact state before the details are loaded', () => {
    context.appSession.store.phone = null;
    context.appSession.store.email = null;
    context.appSession.store.instagram = null;
    renderSettings();
    expect(screen.getByText('Sin datos de contacto')).toBeInTheDocument();
    expect(screen.getByTestId('settings-instagram-notice')).toHaveTextContent('Falta el Instagram de la tienda');
    expect(screen.getByTestId('settings-instagram-notice')).toHaveTextContent('seguir usando la app');
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

  it.each(['pending', 'failed'])('abre un enlace directo sin esperar invitaciones (%s)', async state => {
    history.replaceState(null, '', '#/cuenta/configuracion/equipo/m2');
    let resolveMembers!: (value: TeamMember[]) => void;
    let rejectInvites!: (error: Error) => void;
    membersApi.listMembers.mockReturnValueOnce(new Promise(resolve => { resolveMembers = resolve; }));
    vi.mocked(listInvitations).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectInvites = reject; }));
    renderSettings();
    expect(screen.queryByTestId('team-screen')).not.toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
    if (state === 'failed') await act(async () => rejectInvites(new Error('No se pudieron cargar las invitaciones')));
    await act(async () => resolveMembers([member()]));
    expect(screen.getByRole('heading', { name: 'Luis' })).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Ventas' })).toBeChecked();
  });

  it('opens a member, keeps the previous access on cancel and stays open when save fails', async () => {
    const user = userEvent.setup();
    membersApi.listMembers.mockResolvedValue([member()]);
    membersApi.updateMemberSections.mockRejectedValue(new Error('No se pudo guardar'));
    renderSettings();

    await user.click(await screen.findByRole('button', { name: /Luis/ }));
    expect(screen.getByRole('heading', { name: 'Luis' })).toBeInTheDocument();
    expect(screen.queryByText(/luis@test.com/)).not.toBeInTheDocument();
    expect(document.querySelector('.team-member-head .wsub')).not.toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Luis' })).toBeInTheDocument();
  });

  it('keeps the owner locked to every section', async () => {
    membersApi.listMembers.mockResolvedValue([member({ role: 'OWNER', sections: null, user: { id: 'u', displayName: 'Ana', email: 'ana@test.com', avatarUrl: null } })]);
    renderSettings();
    expect(await screen.findByRole('button', { name: /Propietario/ })).toBeDisabled();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('keeps reportes off for an employee until the owner turns it on', async () => {
    const user = userEvent.setup();
    membersApi.listMembers.mockResolvedValue([member({ sections: null })]);
    membersApi.updateMemberSections.mockResolvedValue(member({ sections: ['dashboard', 'reports'] }));
    renderSettings();

    await user.click(await screen.findByRole('button', { name: /Luis/ }));
    expect(screen.getByRole('switch', { name: 'Reportes' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reportes' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Ventas' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reportes' }).closest('.perm')).toHaveTextContent('Sin acceso');

    await user.click(screen.getByRole('switch', { name: 'Reportes' }));
    expect(screen.getByRole('switch', { name: 'Reportes' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reportes' }).closest('.perm')).toHaveTextContent('Puede ver esta sección');
    await user.click(screen.getByRole('button', { name: 'Guardar permisos' }));

    await waitFor(() => expect(membersApi.updateMemberSections).toHaveBeenCalled());
    const saved = membersApi.updateMemberSections.mock.calls[0]?.[3] as string[];
    expect(saved).toContain('reports');
    expect(saved).toContain('sales');
  });

  it('shows reportes on when the employee already has that section', async () => {
    membersApi.listMembers.mockResolvedValue([member({ sections: ['sales', 'reports'] })]);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /Luis/ }));
    expect(screen.getByRole('switch', { name: 'Reportes' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Inventario' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Ventas' })).toBeChecked();
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
    expect(screen.queryByTestId('permissions-save')).not.toBeInTheDocument();
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

describe('settings on a phone', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('keeps the blocks and pins Guardar permisos', async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    membersApi.listMembers.mockResolvedValue([member({
      role: 'MANAGER',
      sections: null,
      user: { id: 'u3', displayName: 'Socio', email: 'socio@test.com', avatarUrl: null },
    })]);
    render(
      <DeskProvider value={{ tab: 'settings', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, back }}>
        <SettingsScreen />
      </DeskProvider>,
    );

    expect(screen.getByTestId('page-back')).toBeInTheDocument();
    expect(screen.getByTestId('settings-store')).toHaveTextContent('Tienda');
    expect(screen.getByTestId('settings-team')).toHaveTextContent('Equipo');
    expect(screen.getByTestId('settings-account')).toHaveTextContent('Mi cuenta');
    expect(screen.getByTestId('settings-logout')).toHaveTextContent('Cerrar sesión');
    expect(screen.getByTestId('settings-invite')).toHaveTextContent('Invitar al equipo');
    await user.click(screen.getByTestId('page-back'));
    expect(back).toHaveBeenCalled();

    await user.click(await screen.findByRole('button', { name: /Socio/ }));
    const bar = screen.getByTestId('permissions-save');
    expect(within(bar).getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Reportes' })).toBeChecked();
  });

  it('shows reportes off for an employee and keeps Guardar permisos pinned', async () => {
    const user = userEvent.setup();
    membersApi.updateMemberSections.mockReset();
    membersApi.listMembers.mockResolvedValue([member({ sections: null })]);
    membersApi.updateMemberSections.mockResolvedValue(member({ sections: ['reports'] }));
    render(
      <DeskProvider value={{ tab: 'settings', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, back: vi.fn() }}>
        <SettingsScreen />
      </DeskProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /Luis/ }));
    const reports = screen.getByRole('switch', { name: 'Reportes' });
    expect(reports).not.toBeChecked();
    expect(reports).toBeEnabled();
    const bar = screen.getByTestId('permissions-save');
    expect(within(bar).getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    await user.click(reports);
    await user.click(within(bar).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(membersApi.updateMemberSections).toHaveBeenCalled());
    expect(membersApi.updateMemberSections.mock.calls.at(-1)?.[3]).toEqual(expect.arrayContaining(['reports']));
  });
});

describe('employee settings', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    context.appSession.membership.role = 'OWNER';
    window.matchMedia = originalMatchMedia;
  });

  it('does not request the team on desktop', () => {
    context.appSession.membership.role = 'STAFF';
    render(
      <DeskProvider value={{ tab: 'settings', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: true }}>
        <SettingsScreen />
      </DeskProvider>,
    );
    expect(screen.getByTestId('settings-account')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-team')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-store')).not.toBeInTheDocument();
    expect(membersApi.listMembers).not.toHaveBeenCalled();
  });

  it('does not request the team on a phone', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('760'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    context.appSession.membership.role = 'STAFF';
    render(
      <DeskProvider value={{ tab: 'settings', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: true, back: vi.fn() }}>
        <SettingsScreen />
      </DeskProvider>,
    );
    expect(screen.getByTestId('page-back')).toBeInTheDocument();
    expect(screen.getByTestId('settings-account')).toHaveTextContent('Mi cuenta');
    expect(screen.queryByTestId('settings-team')).not.toBeInTheDocument();
    expect(membersApi.listMembers).not.toHaveBeenCalled();
  });
});

describe('issue #71 profiles and team controls', () => {
  beforeEach(() => { window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })); });
  afterEach(() => { context.appSession.membership.role = 'OWNER'; });

  it('toggles visible sections with quick profiles and hides cash controls', async () => {
    membersApi.listMembers.mockResolvedValue([member()]);
    renderSettings();
    await userEvent.click(await screen.findByRole('button', { name: /Luis/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Vendedor' }));
    expect(screen.queryByRole('switch', { name: 'Cajas' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Servicio técnico' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Técnico' }));
    expect(screen.getByRole('switch', { name: 'Servicio técnico' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Ventas' })).not.toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Ver saldo de cajas' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getAllByRole('switch').filter(input => !['Acciones sensibles', 'Ver historial'].includes(input.getAttribute('aria-label') ?? '')).every(input => input.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(screen.getByRole('switch', { name: 'Ver historial' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Acciones sensibles' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Ventas' }));
    expect(screen.queryByRole('switch', { name: 'Cajas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Ver saldo de cajas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personalizado' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides edit controls from a Socio for other Socios, themselves and the owner', async () => {
    context.appSession.membership.role = 'MANAGER';
    membersApi.listMembers.mockResolvedValue([
      member({ id: 'owner', userId: 'owner', role: 'OWNER' }),
      member({ id: 'me', userId: 'u', role: 'MANAGER' }),
      member({ id: 'peer', userId: 'peer', role: 'MANAGER' }),
      member(),
    ]);
    renderSettings();
    for (const id of ['owner', 'me', 'peer']) expect(await screen.findByTestId(`settings-member-${id}`)).toBeDisabled();
    expect(screen.getByTestId('settings-member-m2')).toBeEnabled();
    expect(screen.getByTestId('settings-invite')).toBeInTheDocument();
  });
});


it('confirms removal and leaves a failed persistence visible before closing', async () => {
  context.appSession.membership.role = 'OWNER';
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  membersApi.listMembers.mockResolvedValue([member()]);
  membersApi.removeMember.mockRejectedValueOnce(new Error('No se pudo quitar'));
  renderSettings();
  await userEvent.click(await screen.findByRole('button', { name: /Luis/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Quitar del equipo' }));
  const confirmation = screen.getByRole('alertdialog');
  expect(membersApi.removeMember).not.toHaveBeenCalled();
  await userEvent.click(within(confirmation).getByRole('button', { name: 'Quitar del equipo' }));
  await waitFor(() => expect(within(confirmation).getByRole('alert')).toHaveTextContent('No se pudo quitar'));
  expect(screen.getByRole('heading', { name: 'Luis' })).toBeInTheDocument();
});

it('shows Catálogo below Inventario in the 6 + 5 cards and saves its explicit grant', async () => {
  context.appSession.membership.role = 'OWNER';
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  membersApi.listMembers.mockResolvedValue([member({ sections: null })]);
  membersApi.updateMemberSections.mockResolvedValue(member({ sections: ['publicCatalog'] }));
  renderSettings();
  await userEvent.click(await screen.findByRole('button', { name: /Luis/ }));
  const cards = document.querySelectorAll('.team-perm-columns > .card');
  const labels = (card: Element) => Array.from(card.querySelectorAll('.team-perm:not(.team-nested) b')).map(node => node.textContent);
  expect(labels(cards[0])).toEqual(['Inventario', 'Catálogo', 'Ventas', 'Canjes', 'Clientes', 'Servicio técnico']);
  expect(labels(cards[1])).toEqual(['Reportes', 'Ver historial', 'Comisiones', 'Dashboard', 'Notificaciones']);
  const toggle = screen.getByRole('switch', { name: 'Catálogo' });
  expect(toggle).not.toBeChecked();
  const row = toggle.closest('.team-perm')!;
  expect(within(row as HTMLElement).getByText('Elegir qué equipos se publican, precios y orden').tagName).toBe('SMALL');
  expect(row.querySelector('[data-desk-icon="store"]')).toBeInTheDocument();
  expect(cards[1].querySelector('[data-desk-icon="card"]')).not.toBeInTheDocument();
  await userEvent.click(toggle);
  await userEvent.click(screen.getByRole('button', { name: 'Guardar permisos' }));
  await waitFor(() => expect(membersApi.updateMemberSections).toHaveBeenCalledWith(context.user, 's', 'm2', expect.arrayContaining(['publicCatalog']), false));
  expect(await screen.findByTestId('settings-member-m2')).toHaveTextContent('luis@test.com');
  expect(screen.getByTestId('settings-member-m2')).not.toHaveTextContent('Catálogo');
});
