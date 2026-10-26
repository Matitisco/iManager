import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Client } from '../types';
import { ClientSpending } from './ClientSpending';
import { ExchangeProvider, useMoney } from './exchange';
const client = { id: 'c', totalSpent: 99999, importedSpent: 2400, importedSpentCurrency: 'USD' } as Client;
function View({ compact, customer = client }: { compact?: boolean; customer?: Client }) {
  const money = useMoney();
  return <ClientSpending client={customer} parts={[{ amount: 750, currency: 'USD' }]} money={money} compact={compact} />;
}
function show(compact = false, customer = client) {
  render(<ExchangeProvider settings={{ currency: 'USD', exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: 1545, manualSell: 1565 }}><View compact={compact} customer={customer} /></ExchangeProvider>);
}
describe('client historical spending presentation', () => {
  it.each([false, true])('shows the same purchase definition in compact=%s', compact => {
    show(compact);
    expect(screen.getByText('US$ 3.150', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('US$ 99.999')).not.toBeInTheDocument();
  });
  it('keeps normal clients on actual receipts', () => {
    show(false, { id: 'normal', totalSpent: 99999 } as Client);
    expect(screen.getByText('US$ 750')).toBeInTheDocument();
    expect(screen.queryByText('Histórico importado')).not.toBeInTheDocument();
  });
});
