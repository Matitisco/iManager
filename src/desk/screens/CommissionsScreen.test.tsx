import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionPeriod, CommissionPerson } from '../../services/commissions-api';
import { DeskProvider } from '../ui';
import { CommissionsScreen } from './CommissionsScreen';

const api = vi.hoisted(() => ({
  fetchCommissionPeriod: vi.fn(),
  fetchCommissionPerson: vi.fn(),
  saveCommissionRule: vi.fn(),
  markCommissionPaid: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({ user: { getIdToken: async () => 'token' } }),
}));
vi.mock('../../services/commissions-api', () => api);

const toast = vi.fn();
const open = vi.fn();

function person(partial: Partial<CommissionPerson> = {}): CommissionPerson {
  return {
    memberId: 'm-a',
    userId: 'u-a',
    name: 'Vendedor Ejemplo A',
    role: 'STAFF',
    salesCount: 2,
    soldAmount: 8450000,
    commission: 259100,
    rule: { basis: 'PERCENT_SALE', rate: 3, includeAccessories: true, settlement: 'MONTHLY', label: '3% sobre la venta', detail: 'incluye accesorios' },
    paidAt: null,
    sales: [
      { id: 's1', code: '#V-0139', date: '06/10', device: 'iPhone 14 Pro 256GB', accessoriesAmount: 18000, total: 548000, commission: 16440, soldAt: '2026-10-06T15:00:00.000Z' },
    ],
    ...partial,
  };
}

function period(people: CommissionPerson[] = [person()]): CommissionPeriod {
  const commission = people.reduce((sum, item) => sum + item.commission, 0);
  const soldAmount = people.reduce((sum, item) => sum + item.soldAmount, 0);
  return {
    period: { key: '2026-10', label: 'Octubre 2026', closesLabel: '31/10', current: true },
    summary: {
      soldAmount,
      salesCount: people.reduce((sum, item) => sum + item.salesCount, 0),
      commission,
      share: soldAmount ? (commission / soldAmount) * 100 : 0,
      paidAmount: people.filter((item) => item.paidAt).reduce((sum, item) => sum + item.commission, 0),
      paidCount: people.filter((item) => item.paidAt).length,
      peopleCount: people.length,
      pendingAmount: people.filter((item) => !item.paidAt).reduce((sum, item) => sum + item.commission, 0),
    },
    people,
    members: people.map((item) => ({ id: item.memberId, name: item.name, role: item.role })),
    rules: { team: people[0]?.rule ?? null, personal: {} },
  };
}

function renderScreen() {
  return render(
    <DeskProvider value={{ tab: 'commissions', go: vi.fn(), open, openRecord: vi.fn(), close: vi.fn(), toast, isStaff: false }}>
      <CommissionsScreen />
    </DeskProvider>,
  );
}

describe('commissions desk', () => {
  beforeEach(() => {
    toast.mockClear();
    open.mockClear();
    api.fetchCommissionPeriod.mockReset();
    api.fetchCommissionPerson.mockReset();
    api.saveCommissionRule.mockReset();
    api.markCommissionPaid.mockReset();
    api.fetchCommissionPeriod.mockResolvedValue(period());
    api.fetchCommissionPerson.mockResolvedValue({ period: period().period, person: person() });
  });

  it('shows the period totals and opens a seller with their sales', async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(await screen.findByText('Vendedor Ejemplo A')).toBeInTheDocument();
    expect(screen.getByText(/período en curso, cierra el 31\/10/)).toBeInTheDocument();
    expect(screen.getByText('3% sobre la venta')).toBeInTheDocument();
    expect(screen.getByText('incluye accesorios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar pagada' })).toBeInTheDocument();

    await user.click(screen.getByTestId('commission-row-m-a'));
    expect(await screen.findByRole('dialog', { name: 'Vendedor Ejemplo A' })).toBeInTheDocument();
    expect(screen.getByText('#V-0139')).toBeInTheDocument();
    expect(screen.getByText('iPhone 14 Pro 256GB')).toBeInTheDocument();
    await user.click(screen.getByText('#V-0139'));
    expect(open).toHaveBeenCalledWith({ type: 'sale', id: 's1' });
  });

  it('keeps the detail open when marking paid fails and closes the rule editor only after it saves', async () => {
    const user = userEvent.setup();
    api.markCommissionPaid.mockRejectedValue(new Error('No se pudo liquidar'));
    api.saveCommissionRule.mockRejectedValueOnce(new Error('No se pudo guardar la regla'));
    renderScreen();
    await screen.findByText('Vendedor Ejemplo A');
    await user.click(screen.getByTestId('commission-row-m-a'));
    await user.click(await screen.findByRole('button', { name: /Marcar como pagada/ }));
    expect(await screen.findByText('No se pudo liquidar')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Vendedor Ejemplo A' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cambiar regla' }));
    expect(screen.getByRole('dialog', { name: 'Regla de comisión' })).toBeInTheDocument();
    expect(screen.getByText(/En una venta de \$ 650.000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Monto fijo por equipo' }));
    expect(screen.getByText('En una venta de $ 650.000, le corresponden $ 15.000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar regla' }));
    expect(await screen.findByText('No se pudo guardar la regla')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Regla de comisión' })).toBeInTheDocument();

    api.saveCommissionRule.mockResolvedValue(period());
    await user.click(screen.getByRole('button', { name: 'Guardar regla' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Regla de comisión' })).not.toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith('Regla guardada');
  });
});
