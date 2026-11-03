import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ExchangeProvider, useMoney } from './exchange';

function moneyView(currency: 'ARS' | 'USD', rate: number | null = 1250) {
  return renderHook(() => useMoney(), {
    wrapper: ({ children }: { children: ReactNode }) => <ExchangeProvider settings={{ currency, exchangeMode: 'manual', exchangeSource: 'blue', manualBuy: rate, manualSell: rate }}>{children}</ExchangeProvider>,
  }).result.current;
}

describe('#745: texto monetario compartido', () => {
  it('conserva centavos en USD nativos y proyectados solo para mostrar', () => {
    const money = moneyView('USD');
    expect(money.show(1.5, 'USD')).toBe('US$ 1,50');
    expect(money.shown(1875, 'ARS')).toEqual({ text: 'US$ 1,50', currency: 'USD' });
    expect(money.compact(1875, 'ARS')).toBe('US$ 1,50');
    expect(money.showActive(25.8)).toBe('US$ 25,80');
    expect(money.compactActive(25.8)).toBe('US$ 25,80');
    expect(money.show(1875, 'ARS', 0)).toBe('US$ 2');
    // The numeric, input and write APIs keep their existing behavior.
    expect(money.number(1875, 'ARS')).toBe(2);
    expect(money.inputValue(1875, 'ARS')).toBe('2');
    expect(money.commit(1.5, 1.5, 'USD')).toEqual({ amount: 1.5, currency: 'USD' });
  });

  it('mantiene ARS entero y conserva USD originales si falta cotización', () => {
    const ars = moneyView('ARS', null);
    expect(ars.show(25.8, 'ARS')).toBe('$ 26');
    expect(ars.show(1.5, 'USD')).toBe('US$ 1,50');
    expect(ars.shown(25.8, 'USD')).toEqual({ text: 'US$ 25,80', currency: 'USD' });
    expect(ars.compact(1.5, 'USD')).toBe('US$ 1,50');
  });
});
