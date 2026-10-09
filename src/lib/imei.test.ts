import { describe, expect, it } from 'vitest';
import { IMEI_FORMAT_MESSAGE, imeiFormatError } from './imei';

describe('imeiFormatError', () => {
  it('allows an empty value', () => {
    expect(imeiFormatError('')).toBeNull();
    expect(imeiFormatError('   ')).toBeNull();
  });

  it('allows 15 digits', () => {
    expect(imeiFormatError('350000000000095')).toBeNull();
  });

  it('rejects any other format', () => {
    expect(imeiFormatError('12345')).toBe(IMEI_FORMAT_MESSAGE);
    expect(imeiFormatError('3500000000000951')).toBe(IMEI_FORMAT_MESSAGE);
  });
});
