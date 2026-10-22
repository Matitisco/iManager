import { describe, expect, it } from 'vitest';
import { financeDate, financeDateTime, financeDay, financeMonth, openingDescription } from './finance-dates';

describe('fechas de Finanzas', () => {
  it('conserva fechas calendario y calcula meses completos incluso bisiestos', () => {
    expect(financeDate('2026-10-21')).toBe('21/10/2026');
    expect(financeMonth('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29', label: 'febrero de 2024' });
  });
  it('distingue el cambio de día en la zona de tienda', () => {
    const midnight = new Date('2026-10-22T02:30:00Z');
    expect(financeDay(midnight)).toBe('2026-10-21');
    expect(financeDay(midnight, 'UTC')).toBe('2026-10-22');
    expect(financeDateTime(midnight.toISOString())).toBe('21/10/2026 23:30');
    expect(financeDateTime(midnight.toISOString(), 'UTC')).toBe('22/10/2026 02:30');
    expect(openingDescription('2026-10-21T12:12:00Z', 'Ana', undefined, new Date('2026-10-21T17:32:00Z'))).toBe('Abierta hoy, 09:12 por Ana · hace 5 h y 20 min');
    expect(openingDescription('2026-10-21T12:12:00Z', null, undefined, new Date('2026-10-22T04:00:00Z'))).toContain('Abierta ayer, 09:12');
  });
  it('maneja apertura reciente y datos incompletos sin inventar responsables', () => {
    expect(openingDescription('invalid', 'Ana')).toBe('');
    expect(openingDescription('2026-10-21T12:12:00Z', null, 'UTC', new Date('2026-10-21T12:12:10Z'))).toBe('Abierta hoy, 12:12 · recién');
  });
});
