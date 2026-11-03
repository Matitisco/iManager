import { describe, expect, it } from 'vitest';
import { dateTimeInput } from './date-time-input.js';

describe('API datetime compatibility (characterized on Zod 3.25.76)', () => {
  it.each([
    '2026-11-03T12:30Z', '2026-11-03T12:30:00Z',
    '2026-11-03T12:30:00.123456Z', '2024-02-29T00:00Z',
  ])('accepts UTC with optional seconds: %s', value => {
    expect(dateTimeInput().parse(value)).toBe(value);
  });
  it.each(['2026-11-03T12:30-0300', '2026-11-03T12:30:00+03:00'])('preserves offsets when enabled: %s', value => {
    expect(dateTimeInput({ offset: true }).parse(value)).toBe(value);
    expect(dateTimeInput().safeParse(value).success).toBe(false);
  });
  it.each(['2026-02-30T12:30:00Z', '2026-11-03T25:00Z', '2026-11-03T12:60Z', '2026-11-03T12:30', '2026-11-03'])('rejects invalid dates and times: %s', value => {
    expect(dateTimeInput({ offset: true }).safeParse(value).success).toBe(false);
  });
});
