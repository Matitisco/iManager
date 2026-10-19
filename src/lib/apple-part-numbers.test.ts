import { describe, expect, it } from 'vitest';
import { lookupPartNumber } from './apple-part-numbers';

describe('Apple part numbers', () => {
  it('ignores the region suffix', () => {
    expect(lookupPartNumber('MLPF3LE/A')).toEqual({ model: 'iPhone 13', capacity: '128GB', color: 'Medianoche' });
    expect(lookupPartNumber('mlpf3ll/a')).toEqual({ model: 'iPhone 13', capacity: '128GB', color: 'Medianoche' });
  });

  it('returns null when the code is not in the table', () => {
    expect(lookupPartNumber('ZZZZ9LL/A')).toBeNull();
    expect(lookupPartNumber('')).toBeNull();
  });
});
