import { describe, expect, it } from 'vitest';
import { extractImei, extractImeiLoose, parseDeviceCode } from './device-scan';

describe('device scan parsing', () => {
  it('detects only the model from a known TAC without treating it as a box', () => {
    expect(parseDeviceCode('353893101224013')).toMatchObject({
      imei: '353893101224013', model: 'iPhone 11 Pro Max', capacity: null, color: null, rich: false,
    });
    expect(parseDeviceCode('353893101224014').model).toBeNull();
  });

  it('gives the box label priority over a conflicting TAC', () => {
    expect(parseDeviceCode('MLPF3LE/A 353893101224013')).toMatchObject({
      model: 'iPhone 13', capacity: '128GB', color: 'Medianoche', rich: true,
    });
    expect(parseDeviceCode('ZZZZ9LL/A 353893101224013')).toMatchObject({
      model: 'iPhone 11 Pro Max', capacity: null, color: null, rich: true,
    });
  });
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

  it.each(['F', 'N', 'P'])('maps a box label with the %s prefix', (prefix) => {
    expect(parseDeviceCode(`${prefix}YD13LL/A F2LXK9POQ1 352098117744522`)).toMatchObject({
      partNumber: `${prefix}YD13LL/A`,
      serial: 'F2LXK9POQ1',
      imei: '352098117744522',
      model: 'iPhone 16', capacity: '256GB', color: 'Azul ultramar', rich: true,
    });
  });

  it.each(['FYD13ABC1234', 'NYD13ABC1234', 'PYD13ABC1234', 'xFYD13word', 'xFYD13LL/A', 'FYD13LL/Aword', '352098117744522'])('does not interpret %s as a part number', (raw) => {
    expect(parseDeviceCode(raw)).toMatchObject({ partNumber: null, model: null, capacity: null, color: null });
  });
});
