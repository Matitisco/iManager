import type { Client, OperationClientOption } from '../types';

export const CLIENT_SUGGESTION_LIMIT = 6;

export function clientSuggestions<T extends Client | OperationClientOption>(clients: T[], query: string, limit = CLIENT_SUGGESTION_LIMIT): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle || limit <= 0) return [];
  const matches: T[] = [];
  for (const client of clients) {
    const haystack = [client.name, 'phone' in client ? client.phone : '', 'dni' in client ? client.dni : '', 'email' in client ? client.email : ''].join(' ').toLowerCase();
    if (!haystack.includes(needle)) continue;
    matches.push(client);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function clientHint(client: Client | OperationClientOption): string {
  if (!('phone' in client)) return 'Cliente existente';
  const parts = [
    client.phone?.trim(),
    client.dni?.trim() ? `DNI ${client.dni.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'Cliente de la tienda';
}
