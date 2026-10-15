import { describe, expect, it } from 'vitest';
import { cashMethod, convertedMoney, countedMoney } from './math.js';

describe('dinero de caja en moneda original', () => {
  it('cuenta billetes ARS y monedas USD sin errores binarios ni cotización', () => {
    expect(countedMoney('ARS', { '20000': 2, '1000': 3 }).toNumber()).toBe(43000);
    expect(countedMoney('USD', { '100': 2, '0.1': 3, '0.01': 2 }).toNumber()).toBe(200.32);
    expect(countedMoney('USD', {}).toNumber()).toBe(0);
  });
  it.each<Record<string, number>>([{ '3': 1 }, { '100': -1 }, { '100': 1.2 }, { '100': 1000001 }])('rechaza denominaciones o cantidades inválidas: %j', counts => {
    expect(() => countedMoney('USD', counts)).toThrow('Revisá');
  });
  it('rechaza monedas desconocidas y un conteo fuera de rango', () => {
    expect(() => countedMoney('EUR', {})).toThrow('Moneda inválida');
    expect(() => countedMoney('ARS', { '20000': 1000000 })).toThrow('máximo');
  });
  it('transfiere la misma moneda sin consultar ni aplicar una cotización', () => {
    expect(convertedMoney(123.45, 'USD', 'USD', 2000).toNumber()).toBe(123.45);
  });
  it('solo convierte en la operación explícita con la cotización revisada', () => {
    expect(convertedMoney(20, 'USD', 'ARS', 1234.56).toNumber()).toBe(24691.2);
    expect(convertedMoney(1000, 'ARS', 'USD', 1500).toNumber()).toBe(0.67);
  });
  it.each([undefined, 0, -2, Infinity, NaN])('no convierte sin una cotización válida: %s', rate => {
    expect(() => convertedMoney(1, 'USD', 'ARS', rate)).toThrow('cotización');
  });
  it('rechaza conversiones que desbordan o redondean a cero', () => {
    expect(() => convertedMoney(100000000, 'USD', 'ARS', 1000)).toThrow('rango');
    expect(() => convertedMoney(0.01, 'ARS', 'USD', 1000)).toThrow('rango');
  });
  it.each([['efectivo', 'EFECTIVO'], ['Transferencia bancaria', 'TRANSFERENCIA'], ['TRANSFER', 'TRANSFERENCIA'], ['TARJETA', null]])('normaliza %s sin elegir otro medio', (input, expected) => {
    expect(cashMethod(input)).toBe(expected);
  });
});
