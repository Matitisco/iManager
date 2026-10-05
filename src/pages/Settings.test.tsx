import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppMembershipRole } from '../types/app-session';
import { Settings } from './Settings';

const mockContext = vi.hoisted(() => ({
  appSession: {
    user: { id: 'user-1', displayName: 'Ana', avatarUrl: null },
    store: {
      id: 'store-1',
      name: 'Casa Central',
      legalName: null,
      taxId: null,
      phone: null,
      address: null,
      currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires',
    },
    membership: { role: 'OWNER' as AppMembershipRole, isDefault: true },
  },
  updateStore: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockContext,
}));

function renderSettings(role: AppMembershipRole | null, activeTab = 'profile') {
  mockContext.appSession.membership = role
    ? { role, isDefault: true }
    : (null as unknown as { role: AppMembershipRole; isDefault: boolean });
  return render(<Settings activeTab={activeTab} setActiveTab={vi.fn()} />);
}

describe('Settings billing access', () => {
  beforeEach(() => {
    mockContext.updateStore.mockReset();
    mockContext.updateUserProfile.mockReset();
  });

  it('shows Facturación y Suscripción to the owner and the admin', () => {
    const { unmount } = renderSettings('OWNER');
    expect(screen.getByRole('button', { name: 'Facturación' })).toBeInTheDocument();
    unmount();

    renderSettings('MANAGER', 'billing');
    expect(screen.getByRole('button', { name: 'Facturación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Facturación y Suscripción' })).toBeInTheDocument();
  });

  it('hides billing from a seller even if that section is requested', () => {
    const setActiveTab = vi.fn();
    mockContext.appSession.membership = { role: 'STAFF', isDefault: true };
    render(<Settings activeTab="billing" setActiveTab={setActiveTab} />);

    expect(screen.queryByRole('button', { name: 'Facturación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Facturación y Suscripción' })).not.toBeInTheDocument();
    expect(setActiveTab).toHaveBeenCalledWith('profile');
  });
});
