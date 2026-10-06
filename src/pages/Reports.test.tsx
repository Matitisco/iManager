import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReportsOverview } from '../types/reports';
import { Reports } from './Reports';

const fetchReportsOverview = vi.hoisted(() => vi.fn());
const appContext = vi.hoisted(() => ({
  user: { uid: 'user-1' },
  backendStatus: 'ready' as const,
  backendMessage: null as string | null,
  appSession: {
    onboardingRequired: false,
    store: { id: 'store-1', name: 'Local Centro' },
  },
}));

vi.mock('../services/reports-api', () => ({
  fetchReportsOverview,
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => appContext,
}));

const overview: ReportsOverview = {
  filters: {
    rangeKey: 'custom',
    startDate: '2026-09-06T03:00:00.000Z',
    endDate: '2026-10-06T02:59:59.999Z',
  },
  summary: {
    revenue: 900,
    grossProfit: 350,
    unitsSold: 2,
    averageTicket: 450,
    pendingSales: 1,
    pendingAmount: 900,
    marginRate: 38.888,
    approvedTradeIns: 1,
  },
  comparison: {
    available: true,
    revenue: 200,
    grossProfit: 100,
    unitsSold: 1,
    averageTicket: 200,
    revenueChange: 350,
    grossProfitChange: 250,
    unitsChange: 100,
    averageTicketChange: 125,
  },
  salesSeries: [{ label: '05 oct', start: '2026-10-05', revenue: 900, unitsSold: 2 }],
  topProducts: [],
  categories: [{ category: 'Usados', unitsSold: 2, revenue: 900, share: 100 }],
  topClients: [{ client: 'Ana Pérez', purchases: 1, revenue: 400 }],
  paymentMethods: [{ label: 'Efectivo', revenue: 400, count: 1, share: 44.4 }],
  inventory: {
    totalItems: 4,
    availableItems: 2,
    soldItems: 1,
    inReviewItems: 1,
    valuation: { costValue: 150, retailValue: 300 },
    aging: [
      { label: '0-14 días', count: 1, costValue: 100 },
      { label: '15-30 días', count: 0, costValue: 0 },
      { label: '31-60 días', count: 0, costValue: 0 },
      { label: 'Más de 60 días', count: 1, costValue: 50 },
    ],
  },
  clients: { totalClients: 3, activeClients: 2, pendingBalance: 0 },
  tradeIns: { totalInRange: 2, approvedInRange: 1, openInRange: 1, cashGenerated: 120 },
};

describe('Reports', () => {
  it('shows the sales bars and the payment donut from the overview', async () => {
    fetchReportsOverview.mockResolvedValue(overview);
    const user = userEvent.setup();

    render(<Reports />);

    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ventas · últimos 30 días')).toBeInTheDocument();
    expect(screen.getByText('+350%')).toBeInTheDocument();
    expect(screen.getByText('vs. 30 días anteriores · 2 ventas · 1 pendiente')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por medio de pago' })).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(fetchReportsOverview).toHaveBeenCalledWith(
      { uid: 'user-1' },
      expect.objectContaining({ rangeKey: 'custom' })
    );

    await user.click(screen.getByRole('button', { name: 'Modelo' }));
    expect(screen.getByRole('heading', { name: 'Por modelo' })).toBeInTheDocument();
    expect(screen.getByText('Sin modelos en este período.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stock' }));
    expect(screen.getByText('Stock · disponible ahora')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Por estado' })).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Antigüedad' }));
    expect(screen.getByRole('heading', { name: 'Por antigüedad' })).toBeInTheDocument();
    expect(screen.getAllByText('0-14 días').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Más de 60 días').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '3 meses' }));
    await waitFor(() => {
      expect(fetchReportsOverview).toHaveBeenCalledWith(
        { uid: 'user-1' },
        expect.objectContaining({ rangeKey: 'last_90_days' })
      );
    });
  });
});
