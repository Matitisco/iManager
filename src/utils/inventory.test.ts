import { describe, it, expect } from 'vitest';
import { extractMinBattery, formatBatteryDisplay } from './inventory';

describe('extractMinBattery', () => {
  it('returns 100 for empty / null / undefined', () => {
    expect(extractMinBattery('')).toBe(100);
    expect(extractMinBattery(null)).toBe(100);
    expect(extractMinBattery(undefined)).toBe(100);
  });

  it('parses plain numeric strings', () => {
    expect(extractMinBattery('87')).toBe(87);
    expect(extractMinBattery('100')).toBe(100);
  });

  it('strips the % and returns the number', () => {
    expect(extractMinBattery('87%')).toBe(87);
    expect(extractMinBattery('100%')).toBe(100);
  });

  it('returns the MINIMUM of a range string', () => {
    expect(extractMinBattery('83-85%')).toBe(83);
    expect(extractMinBattery('80-90')).toBe(80);
  });

  it('converts decimal fraction to integer percentage', () => {
    expect(extractMinBattery(0.87)).toBe(87);
    expect(extractMinBattery('0.84')).toBe(84);
    expect(extractMinBattery(1)).toBe(1); // 1 is not < 1, falls through to parseInt("1") = 1
  });

  it('handles numeric values directly', () => {
    expect(extractMinBattery(95)).toBe(95);
  });
});

describe('formatBatteryDisplay', () => {
  it('passes through strings that already contain %', () => {
    expect(formatBatteryDisplay('87%')).toBe('87%');
    expect(formatBatteryDisplay('83-85%')).toBe('83-85%');
    expect(formatBatteryDisplay('100%')).toBe('100%');
  });

  it('adds % to plain numeric strings', () => {
    expect(formatBatteryDisplay('87')).toBe('87%');
    expect(formatBatteryDisplay('100')).toBe('100%');
  });

  it('converts decimal fraction to percentage string', () => {
    expect(formatBatteryDisplay('0.87')).toBe('87%');
  });

  it('handles numeric values', () => {
    expect(formatBatteryDisplay(90)).toBe('90%');
  });
});
