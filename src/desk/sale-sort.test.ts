import { describe, expect, it } from 'vitest';
import type { Sale } from '../types';
import { compareSaleLoadOrder, sortSales } from './sale-sort';

const sale = (id: string, saleNumber: number, createdAt?: string | null, amount = 100) => ({ id, saleNumber, createdAt, amount } as Sale);
const ids = (rows: Sale[]) => rows.map(row => row.id);

describe('orden de visualización de ventas', () => {
  it('ordena por fecha y hora de carga, número descendente y finalmente id', () => {
    const rows = [sale('a', 13, '2026-11-03T10:00:00Z'), sale('b', 7, '2026-11-03T14:00:00Z'), sale('c', 16, '2026-11-03T10:00:00Z'), sale('d', 16, '2026-11-03T10:00:00Z'), sale('e', 99, '2026-11-02T22:00:00Z')];
    expect(ids(sortSales(rows))).toEqual(['b', 'd', 'c', 'a', 'e']);
    expect(ids(rows)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids(sortSales([...rows].reverse()))).toEqual(['b', 'd', 'c', 'a', 'e']);
    expect(compareSaleLoadOrder(rows[0], rows[0])).toBe(0);
  });

  it('sin timestamp válido usa número e id, nunca la fecha comercial editable', () => {
    const rows = [sale('a', 7), sale('b', 13, 'inválido'), sale('c', 16, null), { ...sale('d', 1, '2026-10-01T10:00:00Z'), date: '2020-01-01' }];
    expect(ids(sortSales(rows))).toEqual(['d', 'c', 'b', 'a']);
  });

  it.each(['asc', 'desc'] as const)('mantiene el desempate por carga al ordenar números (%s)', direction => {
    const rows = [sale('a', 1, undefined, 20), sale('b', 2, undefined, 20), sale('c', 3, undefined, 100)];
    expect(ids(sortSales(rows, direction, row => row.amount))).toEqual(direction === 'asc' ? ['b', 'a', 'c'] : ['c', 'b', 'a']);
  });

  it('compara texto en español con números naturales y deja desconocidos al final', () => {
    const rows = [sale('Equipo 10', 1), sale('Equipo 2', 2), sale('sin dato', 3)];
    const value = (row: Sale) => row.id === 'sin dato' ? null : row.id;
    expect(ids(sortSales(rows, 'asc', value))).toEqual(['Equipo 2', 'Equipo 10', 'sin dato']);
    expect(ids(sortSales(rows, 'desc', value))).toEqual(['Equipo 10', 'Equipo 2', 'sin dato']);
  });
});
