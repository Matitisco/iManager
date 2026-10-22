import { describe, expect, it } from 'vitest';
import { isDateValue } from './date-value';

describe('calendar day persistence', () => {
  it.each(['2000-02-29', '2024-02-29', '2026-10-22', '1990-01-01'])('accepts %s without a timezone conversion', value => {
    expect(isDateValue(value)).toBe(true);
  });
  it.each(['', '12/', '22/10/2026', '2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026-10-22T00:00:00Z'])('rejects invalid or non-ISO day %s', value => {
    expect(isDateValue(value)).toBe(false);
  });
});
