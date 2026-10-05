import { describe, expect, it } from 'vitest';
import { normalizeDropdownOptions } from './dropdown-options';

describe('normalizeDropdownOptions', () => {
  it('trims values and drops blanks and duplicates', () => {
    expect(normalizeDropdownOptions([' Nuevo ', 'usado', '', 'NUEVO', 'Usado', '  '])).toEqual([
      'Nuevo',
      'usado',
    ]);
  });
});