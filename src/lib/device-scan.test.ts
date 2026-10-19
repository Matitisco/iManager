import { describe, expect, it } from 'vitest';
import { extractImei, extractImeiLoose, parseDeviceCode } from './device-scan';

describe('device scan parsing', () => {
  it('reads a Luhn IMEI from spaced, plain and GS1 text', () => {
    expect(extractImei('35 209811 774452 2')).toBe('352098117744522');
    expect(extractImei('prefix 352098117744522 suffix')).toBe('352098117744522');
    expect(extractImei('010352098117744522')).toBe('352098117744522');
    expect(extractImei('352098117744521')).toBeNull();
  });

  it('falls back to the first 15 digits when the stock code fails Luhn', () => {
    expect(extractImeiLoose('352098117744521')).toBe('352098117744521');
  });

  it('maps an Apple box label to model, capacity and color', () => {
    const parsed = parseDeviceCode('MLPF3LE/A F2LXK9POQ1 352098117744522');
    expect(parsed).toMatchObject({
      imei: '352098117744522',
      serial: 'F2LXK9POQ1',
      partNumber: 'MLPF3LE/A',
      model: 'iPhone 13',
      capacity: '128GB',
      color: 'Medianoche',
      rich: true,
    });
  });

  it('leaves an unknown part number for the operator to complete', () => {
    const parsed = parseDeviceCode('ZZZZ9LL/A F2LXK9POQ1 352098117744522');
    expect(parsed.partNumber).toBe('ZZZZ9LL/A');
    expect(parsed.model).toBeNull();
    expect(parsed.rich).toBe(true);
  });
});
