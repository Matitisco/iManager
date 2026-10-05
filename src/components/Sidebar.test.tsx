import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    logout: vi.fn(),
    appSession: {
      store: { id: 'store-1', name: 'iPhone Store!' },
      membership: { role: 'OWNER', isDefault: true },
      stores: [{ id: 'store-1', name: 'iPhone Store!', role: 'OWNER', isDefault: true }],
    },
  }),
}));

describe('Sidebar', () => {
  it('keeps the store switcher hidden and still shows logout', () => {
    render(<Sidebar activeTab="settings" setActiveTab={() => {}} />);

    expect(screen.queryByRole('button', { name: /iPhone Store!/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
  });
});
