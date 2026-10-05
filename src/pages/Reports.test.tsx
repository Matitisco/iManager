import { render, screen } from '@testing-library/react';
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
    rangeKey: 'this_month',
    startDate: '2026-10-01T03:00:00.000Z',
    endDate: '2026-10-05T02:59:59.999Z',
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
  salesSeries: [],
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
  it('shows store metrics from the overview instead of placeholder cards', async () => {
    fetchReportsOverview.mockResolvedValue(overview);

    render(<Reports />);

    expect(await screen.findByRole('heading', { name: 'Mix del período' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText('Usados')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('0-14 días')).toBeInTheDocument();
    expect(screen.getByText('Más de 60 días')).toBeInTheDocument();
    expect(screen.getByText('+350,0%')).toBeInTheDocument();
    expect(screen.getByText(/1 pendientes por/i)).toBeInTheDocument();
    expect(fetchReportsOverview).toHaveBeenCalledWith(
      { uid: 'user-1' },
      expect.objectContaining({ rangeKey: 'this_month' })
    );
  });
});
