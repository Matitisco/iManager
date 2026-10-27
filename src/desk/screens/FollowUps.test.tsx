import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FollowUpCard, FollowUpGroup, FollowUpSettings } from '../../services/accounts-api';
import { DeskProvider } from '../ui';
import { FollowUps } from './FollowUps';

const api = vi.hoisted(() => ({
  fetchFollowUps: vi.fn(),
  saveFollowUpSettings: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ user: { getIdToken: async () => 'token' } }),
}));
vi.mock('../../services/accounts-api', () => api);

const settings: FollowUpSettings = {
  birthdayLeadDays: 7,
  warrantyMonths: 12,
  warrantyLeadDays: 15,
  inactiveDays: 180,
  includeDebts: true,
};

function card(partial: Partial<FollowUpCard> & Pick<FollowUpCard, 'id' | 'kind' | 'name'>): FollowUpCard {
  return {
    clientId: partial.id,
    phone: '1162007525',
    title: 'Título viejo',
    detail: 'TEXTO VIEJO QUE NO DEBE VERSE',
    amount: null,
    dueDate: null,
    lastPurchaseAt: null,
    warrantyEndsAt: null,
    deviceLabel: null,
    currency: 'ARS',
    installmentSequence: null,
    installmentCount: null,
    birthdayOn: null,
    turningAge: null,
    warrantyDays: null,
    ...partial,
  };
}

const debt = card({ id: 'debt-lucia', kind: 'DEUDA', name: 'Lucía Fernández', amount: 640000, dueDate: '2026-10-02', phone: '1162007525' });
const birthday = card({ id: 'birthday-martin', kind: 'CUMPLEANOS', name: 'Martín Acosta', birthdayOn: '2026-10-19', phone: '1145399666' });
const quiet = card({ id: 'inactive-pablo', kind: 'INACTIVO', name: 'Pablo Ríos', phone: '', lastPurchaseAt: '2026-04-09', deviceLabel: 'iPhone 11' });

const groups: FollowUpGroup[] = [
  { kind: 'DEUDA', count: 1, totalAmount: 640000, currency: 'ARS' },
  { kind: 'CUMPLEANOS', count: 1, totalAmount: null, currency: null },
  { kind: 'INACTIVO', count: 1, totalAmount: null, currency: null },
];

function renderFollowUps(open = vi.fn(), query = '') {
  return render(
    <DeskProvider value={{ tab: 'clients', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false, canManageSensitive: true }}>
      <FollowUps query={query} />
    </DeskProvider>,
  );
}

describe('seguimientos', () => {
  beforeEach(() => {
    api.fetchFollowUps.mockReset();
    api.fetchFollowUps.mockResolvedValue({ today: '2026-10-18', settings, cards: [debt, birthday, quiet], groups });
  });

  it('muestra el esqueleto y después la lista agrupada con los campos, sin leer el texto viejo', async () => {
    let resolveLoad: (value: unknown) => void = () => undefined;
    api.fetchFollowUps.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    renderFollowUps();
    expect(screen.getByTestId('follow-ups-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('follow-empty')).not.toBeInTheDocument();
    resolveLoad({ today: '2026-10-18', settings, cards: [debt, birthday, quiet], groups });
    expect(await screen.findByText('Lucía Fernández')).toBeInTheDocument();
    expect(screen.queryByText('TEXTO VIEJO QUE NO DEBE VERSE')).not.toBeInTheDocument();
    expect(screen.queryByText('Título viejo')).not.toBeInTheDocument();
    expect(screen.getByText('$ 640.000', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Debe desde el 02/10')).toBeInTheDocument();
    expect(screen.getByText('$ 640.000 en total')).toBeInTheDocument();
    expect(screen.getByText('Mañana')).toBeInTheDocument();
    expect(screen.getByText('Cumple el 19/10')).toBeInTheDocument();
    expect(screen.getByText('esta semana')).toBeInTheDocument();
    expect(screen.getByText('09/04/2026')).toBeInTheDocument();
    expect(screen.getByText('Última compra · iPhone 11')).toBeInTheDocument();
    expect(screen.getByText('más de 180 días')).toBeInTheDocument();
    expect(screen.getByText('Deuda', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('3 clientes · dom 18/10')).toBeInTheDocument();
    const order = screen.getAllByTestId(/follow-group-/).map((node) => node.getAttribute('data-testid'));
    expect(order).toEqual(['follow-group-DEUDA', 'follow-group-CUMPLEANOS', 'follow-group-INACTIVO']);
    expect(screen.getByRole('link', { name: 'Escribirle a Lucía Fernández por WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me'));
  });

  it('deshabilita WhatsApp sin teléfono y abre la ficha para cargarlo', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    renderFollowUps(open);
    const row = await screen.findByTestId('follow-INACTIVO');
    expect(within(row).getByRole('button', { name: 'WhatsApp no disponible para Pablo Ríos' })).toBeDisabled();
    expect(within(row).getByRole('tooltip')).toHaveTextContent('Cargá su teléfono para escribirle por WhatsApp');
    await user.click(within(row).getByRole('button', { name: 'Agregar' }));
    expect(open).toHaveBeenCalledWith({ type: 'cl', id: 'inactive-pablo' });
  });

  it('filtra por motivo y por la búsqueda', async () => {
    const user = userEvent.setup();
    const view = renderFollowUps();
    await screen.findByText('Lucía Fernández');
    await user.click(screen.getByRole('button', { name: 'Cumpleaños 1' }));
    expect(screen.queryByText('Lucía Fernández')).not.toBeInTheDocument();
    expect(screen.getByText('Martín Acosta')).toBeInTheDocument();
    view.unmount();
    const searched = renderFollowUps(vi.fn(), 'pablo');
    expect(await screen.findByText('Pablo Ríos')).toBeInTheDocument();
    expect(screen.queryByText('Lucía Fernández')).not.toBeInTheDocument();
    expect(screen.queryByText('No hay seguimientos con esa búsqueda.')).not.toBeInTheDocument();
    searched.unmount();
    renderFollowUps(vi.fn(), 'sin coincidencias');
    expect(await screen.findByText('No hay seguimientos con esa búsqueda.')).toHaveClass('table-empty');
  });

  it('muestra el vacío real y no un falso vacío mientras carga', async () => {
    const user = userEvent.setup();
    api.fetchFollowUps.mockResolvedValue({ today: '2026-10-18', settings, cards: [], groups: [] });
    renderFollowUps();
    expect(await screen.findByTestId('follow-empty')).toHaveTextContent('Hoy no hay a quién escribir');
    expect(screen.getByText('Hoy no hay pendientes · dom 18/10')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar reglas' }));
    expect(screen.getByRole('dialog', { name: 'Reglas de seguimiento' })).toBeInTheDocument();
  });

  it('en el teléfono ofrece agregar el teléfono y esconde la insignia', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    renderFollowUps();
    const row = await screen.findByTestId('follow-INACTIVO');
    expect(within(row).getByRole('button', { name: 'Agregar teléfono' })).toBeInTheDocument();
    expect(screen.queryByText('Deuda', { exact: true })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Lucía Fernández')).toBeInTheDocument());
  });
});
