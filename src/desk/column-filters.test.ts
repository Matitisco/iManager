import { describe, expect, it } from 'vitest';
import { includesText, matchesDateRange, matchesMoney } from './column-filters';

describe('column filters', () => {
  it('matches text, money and dates, and ignores an unreadable bound', () => {
    expect(includesText('Ana Pérez', '')).toBe(true);
    expect(includesText('Ana Pérez', ' pé ')).toBe(true);
    expect(includesText('Ana Pérez', 'juan')).toBe(false);

    expect(matchesMoney(1000, '', '')).toBe(true);
    expect(matchesMoney(1000, '500', '1.500')).toBe(true);
    expect(matchesMoney(1000, '2000', '')).toBe(false);
    expect(matchesMoney(1000, '', '500')).toBe(false);

    expect(matchesDateRange('2026-10-01', '', '')).toBe(true);
    expect(matchesDateRange('2026-10-01', '01/10/2026', '07/10/2026')).toBe(true);
    expect(matchesDateRange('01/09/2026', '01/10/2026', '')).toBe(false);
    expect(matchesDateRange('2026-10-08', '', '07/10/2026')).toBe(false);
    expect(matchesDateRange('2026-10-01', '32/13/2026', '')).toBe(true);
    expect(matchesDateRange('', '01/10/2026', '')).toBe(false);
    expect(matchesDateRange('N/A', '', '07/10/2026')).toBe(false);
  });
});
