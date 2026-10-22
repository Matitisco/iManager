import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Sale, Product } from '../../types';
import type { ReturnCaseView } from '../../services/returns-api';
import { NetProfitCard } from './ReportsScreen';

it('excludes cancelled claims from return totals and net profit even without deletedAt', () => {
  const props = {
    loading: false, start: new Date(2026, 9, 1), end: new Date(2026, 9, 31, 23, 59, 59), currency: 'ARS' as const,
    rate: 1300, show: (amount: number) => `$ ${amount}`, warning: null, expenses: [],
    sales: [{ id: 'sale', date: '2026-10-21', amount: 1200, amountCurrency: 'ARS', productId: 'device', status: 'COMPLETADA' }] as Sale[],
    inventory: [{ id: 'device', cost: 800, currency: 'ARS' }] as Product[],
  };
  const claim = { id: 'claim', status: 'RESUELTO', resolution: 'REINTEGRO', resolvedOn: '2026-10-22', moneyAmount: 1200, moneyCurrency: 'ARS', saleAmount: 1200, itemCost: 800, itemCurrency: 'ARS', deletedAt: null } as ReturnCaseView;
  const { rerender } = render(<NetProfitCard {...props} returns={[claim]} />);
  expect(screen.getByTestId('net-profit-returns')).toHaveTextContent('$ 1200');
  expect(screen.getByText('Ganancia neta').parentElement).toHaveTextContent('$ 0');
  rerender(<NetProfitCard {...props} returns={[{ ...claim, status: 'ANULADO' }]} />);
  expect(screen.queryByTestId('net-profit-returns')).not.toBeInTheDocument();
  expect(screen.getByText('Ganancia neta').parentElement).toHaveTextContent('$ 400');
});
