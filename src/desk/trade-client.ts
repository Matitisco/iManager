import type { Client } from '../types';

export const CLIENT_SUGGESTION_LIMIT = 6;

export function clientSuggestions(clients: Client[], query: string, limit = CLIENT_SUGGESTION_LIMIT): Client[] {
  const needle = query.trim().toLowerCase();
  if (!needle || limit <= 0) return [];
  const matches: Client[] = [];
  for (const client of clients) {
    const haystack = [client.name, client.phone, client.dni, client.email].join(' ').toLowerCase();
    if (!haystack.includes(needle)) continue;
    matches.push(client);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function clientHint(client: Pick<Client, 'phone' | 'dni'>): string {
  const parts = [
    client.phone?.trim(),
    client.dni?.trim() ? `DNI ${client.dni.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'Cliente de la tienda';
}
