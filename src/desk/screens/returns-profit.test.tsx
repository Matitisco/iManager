import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { Sale, Product } from '../../types';
import type { ReturnCaseView } from '../../services/returns-api';
import { NetProfitCard } from './ReportsScreen';

it.each(['NOTA_CREDITO', 'REINTEGRO'])('reconoce %s al emitir y conserva el período al cerrar el RMA', (settlement) => {
  const props = {
    loading: false, start: new Date(2026, 8, 1), end: new Date(2026, 8, 30, 23, 59, 59), currency: 'ARS' as const,
    rate: 1250, show: (amount: number) => `$ ${amount}`, warning: null, expenses: [],
    sales: [{ id: 'sale', date: '2026-09-20', amount: 560, amountCurrency: 'USD', productId: 'device', status: 'COMPLETADA' }] as Sale[],
    inventory: [{ id: 'device', cost: 410, currency: 'USD' }] as Product[],
  };
  const claim = { id: 'claim', status: 'EN_PROVEEDOR', resolution: 'CAMBIO', settlement, compensatedOn: '2026-09-30', resolvedOn: null, moneyAmount: 560, moneyCurrency: 'USD', saleAmount: 560, itemCost: 410, itemCurrency: 'USD', deletedAt: null } as ReturnCaseView;
  const { rerender } = render(<NetProfitCard {...props} returns={[claim]} />);
  expect(screen.getByTestId('net-profit-returns')).toHaveTextContent('$ 700000');
  expect(screen.getByText('Ganancia neta').parentElement).toHaveTextContent('$ 0');
  const closed = { ...claim, status: 'RESUELTO', resolvedOn: '2026-10-26' };
  rerender(<NetProfitCard {...props} returns={[closed]} />);
  expect(screen.getByTestId('net-profit-returns')).toHaveTextContent('$ 700000');
  expect(screen.getByText('Ganancia neta').parentElement).toHaveTextContent('$ 0');
  rerender(<NetProfitCard {...props} start={new Date(2026, 9, 1)} end={new Date(2026, 9, 31, 23, 59, 59)} returns={[closed]} />);
  expect(screen.queryByTestId('net-profit-returns')).not.toBeInTheDocument();
  expect(screen.getByText('Ganancia neta').parentElement).toHaveTextContent('$ 0');
});

it.each([
  { status: 'ANULADO', deletedAt: null },
  { status: 'ANULADO', deletedAt: '2026-10-22T15:00:00Z' },
  { status: 'RESUELTO', deletedAt: '2026-10-22T15:00:00Z' },
])('excludes cancelled claims from return totals and net profit: %j', (voidFields) => {
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
  rerender(<NetProfitCard {...props} returns={[{ ...claim, ...voidFields }]} />);
  expect(screen.queryByTestId('net-profit-returns')).not.toBeInTheDocument();
  expect(screen.getByText('Ganancia neta').parentElement).toHaveTextContent('$ 400');
});
