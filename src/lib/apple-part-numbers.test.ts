import { describe, expect, it } from 'vitest';
import { APPLE_PARTS, lookupPartNumber } from './apple-part-numbers';
import source from './apple-part-numbers.ts?raw';

describe('Apple part numbers', () => {
  it('has unique keys in the source table', () => {
    const keys = [...source.matchAll(/^  ([A-Z0-9]{5}):/gm)].map((match) => match[1]);
    expect(keys.length).toBe(Object.keys(APPLE_PARTS).length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a non-empty model, capacity and color for every part', () => {
    for (const [code, fields] of Object.entries(APPLE_PARTS)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]{4}$/);
      expect(fields).toHaveLength(3);
      for (const field of fields) expect(field.trim(), code).not.toBe('');
    }
  });

  // Regression cases verified against independent public part-number lists.
  it.each([
    ['MU693LL/A', 'iPhone 15 Pro Max', '256GB', 'Titanio azul'],
    ['MU663', 'iPhone 15 Pro Max', '256GB', 'Titanio negro'],
    ['MTP03LL/A', 'iPhone 15', '128GB', 'Negro'],
    ['MYD13LL/A', 'iPhone 16', '256GB', 'Azul ultramar'],
    ['MYWX3QN/A', 'iPhone 16 Pro Max', '256GB', 'Titanio desierto'],
    ['MFXG4LL/A', 'iPhone 17 Pro Max', '256GB', 'Plata'],
    ['MFXH4LL/A', 'iPhone 17 Pro Max', '256GB', 'Naranja cósmico'],
    ['MG7K4LL/A', 'iPhone 17 Pro', '256GB', 'Plata'],
    ['MLPF3LL/A', 'iPhone 13', '128GB', 'Medianoche'],
    ['MLN23LL/A', 'iPhone 13', '512GB', 'Medianoche'],
    ['MLNM3J/A', 'iPhone 13 mini', '256GB', 'Azul'],
    ['MWLF2LL/A', 'iPhone 11', '128GB', 'Blanco'],
    ['MG2A4J/A', 'iPhone Air', '256GB', 'Azul cielo'],
    ['MG2J4J/A', 'iPhone Air', '1TB', 'Oro claro'],
    ['MG2D4J/A', 'iPhone Air', '512GB', 'Blanco nube'],
    ['MLMU3J/A', 'iPhone 13', '256GB', 'Medianoche'],
    ['MQ4M3LL/A', 'iPhone 14 Plus', '256GB', 'Púrpura'],
    ['MLUK3J/A', 'iPhone 13 Pro', '128GB', 'Azul sierra'],
    ['MLTD3ZA/A', 'iPhone 13 Pro', '256GB', 'Oro'],
    ['MNE13J/A', 'iPhone 13 Pro', '1TB', 'Verde alpino'],
    ['MLJ73J/A', 'iPhone 13 Pro Max', '128GB', 'Azul sierra'],
    ['MNCX3J/A', 'iPhone 13 Pro Max', '1TB', 'Verde alpino'],
    ['MWCD2LL/A', 'iPhone 11 Pro', '512GB', 'Gris espacial'],
  ])('resolves %s', (code, model, capacity, color) => {
    expect(lookupPartNumber(code)).toEqual({ model, capacity, color });
  });

  it.each(['', 'LL/A', 'LE/A', 'BE/A', 'ZD/A', 'LZ/A', 'J/A', 'CH/A', 'ZA/A', 'QN/A', 'VC/A', 'TU/A'])('ignores the region suffix "%s"', (region) => {
    expect(lookupPartNumber(`MLPF3${region}`)).toEqual({ model: 'iPhone 13', capacity: '128GB', color: 'Medianoche' });
  });

  it('normalizes whitespace and lowercase input', () => {
    expect(lookupPartNumber(' mlpf3 ll/a ')).toEqual(lookupPartNumber('MLPF3'));
    expect(lookupPartNumber('mlpf3 j / a')).toEqual(lookupPartNumber('MLPF3'));
  });

  it.each(['F', 'N', 'P'])('resolves the %s prefix to the corresponding M configuration', (prefix) => {
    const expected = { model: 'iPhone 16', capacity: '256GB', color: 'Azul ultramar' };
    expect(lookupPartNumber(`${prefix}YD13LL/A`)).toEqual(expected);
    expect(lookupPartNumber(`${prefix.toLowerCase()}yd13 ll/a`)).toEqual(expected);
    expect(lookupPartNumber(`${prefix}YD13`)).toEqual(expected);
  });

  it('prefers an exact entry over the M prefix fallback', () => {
    // The current table has only M codes; temporarily supply an exact variant.
    Object.defineProperty(APPLE_PARTS, 'FYD13', {
      value: ['iPhone 13', '128GB', 'Medianoche'], configurable: true,
    });
    try {
      expect(lookupPartNumber('FYD13LL/A')).toEqual({ model: 'iPhone 13', capacity: '128GB', color: 'Medianoche' });
    } finally {
      Reflect.deleteProperty(APPLE_PARTS, 'FYD13');
    }
  });

  it.each([
    null, undefined, '', 'garbage', 'ZZZZ9LL/A', 'MNGC3', 'MNGC3LL/A', 'MLTH3', 'MLTH3LL/A',
    'FNGC3LL/A', 'NLTH3J/A', 'FYD99LL/A', 'AYD13LL/A',
    '352098117744522', 'FYD13ABC1234', 'NYD13ABC1234', 'PYD13ABC1234', 'MYD13ABC1234',
    'xFYD13word', 'xFYD13', 'FYD13word', 'xFYD13LL/A', 'FYD13LL/Aword',
    'texto FYD13', 'FYD13 texto', '!FYD13!', 'FYD13LL', 'FYD13/A', 'FYD13LL/B',
    'FYD13ABCD/A', 'MLPF3LL/A/extra',
  ])('returns null for unknown codes and invalid input: %s', (value) => {
    expect(lookupPartNumber(value)).toBeNull();
  });
});
