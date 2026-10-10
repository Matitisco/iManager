import { describe, expect, it } from 'vitest';
import { compareQuality, displayQuality, isUsedCondition, qualityPhrase, tradeQuality } from './quality';

describe('device quality', () => {
  it('shows a grade only when the device is used', () => {
    expect(isUsedCondition('USADO')).toBe(true);
    expect(displayQuality('USADO', 'A+')).toBe('A+');
    expect(displayQuality('USADO', 'a')).toBe('A');
    expect(displayQuality('USADO', '')).toBe('');
    expect(displayQuality('USADO', 'N/A')).toBe('');
    expect(displayQuality('USADO', 'excelente')).toBe('');
    expect(displayQuality('NUEVO', 'A+')).toBe('');
    expect(displayQuality('PRE-OWNED', 'B')).toBe('');
    expect(qualityPhrase('USADO', 'B')).toBe('Calidad B');
    expect(qualityPhrase('NUEVO', 'B')).toBe('');
  });

  it('reads the received trade-in grade as the same scale', () => {
    expect(tradeQuality('C')).toBe('C');
    expect(tradeQuality('N/A')).toBe('');
    expect(tradeQuality(null)).toBe('');
  });

  it('sorts from A+ to C and leaves blanks at the end', () => {
    expect(compareQuality('A+', 'C', 'best')).toBeLessThan(0);
    expect(compareQuality('C', 'A+', 'worst')).toBeLessThan(0);
    expect(compareQuality('', 'A', 'best')).toBeGreaterThan(0);
    expect(compareQuality('', 'C', 'worst')).toBeGreaterThan(0);
    expect(compareQuality('', '', 'best')).toBe(0);
  });
});
