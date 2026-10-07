import { describe, expect, it } from 'vitest';
import type { Client } from '../types';
import { tradeClientLabel } from './format';
import { CLIENT_SUGGESTION_LIMIT, clientSuggestions } from './trade-client';

function client(id: string, name: string, extra: Partial<Client> = {}): Client {
  return {
    id,
    dni: '',
    name,
    email: '',
    phone: '',
    lastPurchaseDate: '',
    totalSpent: 0,
    pendingBalance: 0,
    ...extra,
  };
}

const clients = [
  client('a', 'Ana Gómez', { phone: '11 4444', dni: '30111222' }),
  client('b', 'Bruno Díaz', { email: 'bruno@tienda.com' }),
  ...Array.from({ length: 8 }, (_, index) => client(`x${index}`, `Ana extra ${index}`)),
];

describe('clientSuggestions', () => {
  it('returns nothing until there is a query', () => {
    expect(clientSuggestions(clients, '')).toEqual([]);
    expect(clientSuggestions(clients, '   ')).toEqual([]);
  });

  it('matches name, phone, dni and email, and caps the list', () => {
    expect(clientSuggestions(clients, 'bru').map((item) => item.id)).toEqual(['b']);
    expect(clientSuggestions(clients, '3011').map((item) => item.id)).toEqual(['a']);
    expect(clientSuggestions(clients, '4444').map((item) => item.id)).toEqual(['a']);
    expect(clientSuggestions(clients, 'bruno@').map((item) => item.id)).toEqual(['b']);
    expect(clientSuggestions(clients, 'ana')).toHaveLength(CLIENT_SUGGESTION_LIMIT);
  });
});

describe('tradeClientLabel', () => {
  it('prefers the linked client and falls back to the typed name', () => {
    expect(tradeClientLabel({ clientId: 'a', clientName: 'Otro' }, clients)).toBe('Ana Gómez');
    expect(tradeClientLabel({ clientId: '', clientName: 'Mostrador' }, clients)).toBe('Mostrador');
    expect(tradeClientLabel({ clientId: 'missing', clientName: 'Mostrador' }, clients)).toBe('Mostrador');
    expect(tradeClientLabel({ clientId: '' }, clients)).toBe('Consumidor final');
    expect(tradeClientLabel({ clientId: 'missing' }, clients)).toBe('Sin cliente');
  });
});
