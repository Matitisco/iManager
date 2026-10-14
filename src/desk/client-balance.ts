import type { Client, ClientDeposit } from '../types';
import { depositAmount } from './deposits';

export function clientCredit(client: Pick<Client, 'creditBalance'>) {
  const credit = client.creditBalance ?? 0;
  return credit > 0 ? credit : 0;
}

export function clientNet(client: Pick<Client, 'pendingBalance' | 'creditBalance'>) {
  return client.pendingBalance - clientCredit(client);
}

export function creditTotal(rows: Pick<ClientDeposit, 'status' | 'currency' | 'amount' | 'usdAmount' | 'exchangeRate'>[], currency: string | null) {
  const target = currency === 'USD' ? 'USD' : 'ARS';
  return rows
    .filter((row) => row.status === 'CREDIT')
    .reduce((sum, row) => sum + (depositAmount(row, target, row.exchangeRate) ?? 0), 0);
}
