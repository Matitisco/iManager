import { describe, expect, it } from 'vitest';
import { DONUT_LABEL_WIDTH, donutTextWidth, fitDonutText, fitDonutValue } from './donut-label';
import { formatMoneyCompact } from './format';

describe.each([false, true])('donut label (phone: %s)', (phone) => {
  it.each([0, 100, 750_000, 12_345_678, 8_000_000, 999_999, -999_999, 999_999_999_999, -999_999_999_999, 1e15, Number.MAX_VALUE])('fits %s without losing the exact total', (amount) => {
    for (const currency of ['ARS', 'USD'] as const) {
      const fitted = fitDonutValue(amount, currency, phone);
      expect(fitted.fontSize).toBeGreaterThanOrEqual(11);
      expect(fitted.fontSize).toBeLessThanOrEqual(phone ? 13 : 18);
      expect(donutTextWidth(fitted.text, fitted.fontSize, phone)).toBeLessThanOrEqual(DONUT_LABEL_WIDTH);
      expect(fitted.fullText).toContain(new Intl.NumberFormat('es-AR').format(Math.round(amount)));
      expect(fitted.text).not.toContain('…');
    }
  });
  it('retains short counts and percentages at the existing maximum', () => {
    expect(fitDonutValue(1234, undefined, phone)).toMatchObject({ text: '1234', fontSize: phone ? 13 : 18, fullText: '1234' });
    expect(fitDonutText('60%', phone)).toEqual({ text: '60%', fontSize: phone ? 13 : 18 });
    expect(fitDonutText('100%', phone).fontSize).toBe(phone ? 13 : 18);
  });
  it('compacts a long USD total using a decimal comma', () => {
    const fitted = fitDonutValue(987_654, 'USD', phone);
    expect(fitted.text).toBe(phone ? 'US$ 987,7k' : 'US$ 988k');
    expect(fitted.fullText).toBe('US$ 987.654');
  });
});

it('shrinks $ 750.000 on desktop and preserves the fitting phone maximum', () => {
  expect(fitDonutValue(750_000, 'ARS').text).toBe('$ 750.000');
  expect(fitDonutValue(750_000, 'ARS').fontSize).toBeLessThan(18);
  expect(fitDonutValue(750_000, 'ARS', true).fontSize).toBe(13);
});
it('keeps the shared compact formatter unchanged', () => {
  expect(formatMoneyCompact(750_000)).toBe('$ 750.000');
  expect(formatMoneyCompact(12_345_678)).toBe('$ 12,35M');
});
