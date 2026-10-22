import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupTabs, NavChrome } from './group-tabs';
import { EMPTY_PENDING, type PendingInput } from './nav';
import type { DeskTab } from './types';
import { DeskProvider } from './ui';

const ctx = vi.hoisted(() => ({ appSession: { membership: { role: 'OWNER', sections: null as string[] | null } } }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
const go = vi.fn();

function mount(tab: DeskTab = 'clients', pending: PendingInput = { ...EMPTY_PENDING, openRepairs: 2 }) {
  return render(<DeskProvider value={{ tab, go, open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>
    <NavChrome pending={pending}><GroupTabs /></NavChrome>
  </DeskProvider>);
}
beforeEach(() => { ctx.appSession.membership = { role: 'OWNER', sections: null }; });

describe('pestañas de grupo sin explicación adicional', () => {
  it.each(['clients', 'service'] as const)('keeps repair counts and accessible descriptions on %s', tab => {
    const { container } = mount(tab);
    const service = screen.getByRole('tab', { name: 'Servicio técnico · 2' });
    expect(service).toHaveAttribute('title', '2 órdenes de servicio abiertas');
    expect(service).toHaveAccessibleDescription('2 órdenes de servicio abiertas');
    expect(screen.getByRole('tab', { selected: true })).toHaveAttribute('data-testid', `group-tab-${tab}`);
    expect(screen.queryByText('Qué cuenta cada indicador')).not.toBeInTheDocument();
    expect(screen.queryByText('2 órdenes de servicio abiertas.')).not.toBeInTheDocument();
    expect(container.querySelector('details')).toBeNull();
    fireEvent.click(service);
    expect(go).toHaveBeenCalledWith('service');
  });

  it('keeps client unread counts and descriptions and omits zero counts', () => {
    mount('clients', { ...EMPTY_PENDING, unread: { ...EMPTY_PENDING.unread, clients: 3 } });
    const clients = screen.getByRole('tab', { name: 'Clientes · 3' });
    expect(clients).toHaveAttribute('title', '3 avisos sin leer en Clientes');
    expect(clients).toHaveAccessibleDescription('3 avisos sin leer en Clientes');
    const service = screen.getByRole('tab', { name: 'Servicio técnico' });
    expect(service).not.toHaveAttribute('title');
    expect(service).not.toHaveAttribute('aria-description');
  });

  it('omits the group when only one section is permitted', () => {
    ctx.appSession.membership = { role: 'STAFF', sections: ['clients'] };
    const { container } = mount();
    expect(container).toBeEmptyDOMElement();
  });
});
