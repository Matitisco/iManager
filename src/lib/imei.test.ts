import { describe, expect, it } from 'vitest';
import { IMEI_FORMAT_MESSAGE, IMEI_LUHN_MESSAGE, imeiFormatError, imeiLoadError, imeiPassesLuhn } from './imei';

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

describe('imei Luhn', () => {
  it('accepts the Wikipedia example and a check digit we can load', () => {
    expect(imeiPassesLuhn('490154203237518')).toBe(true);
    expect(imeiPassesLuhn('352098117744522')).toBe(true);
    expect(imeiLoadError('352098117744522')).toBeNull();
  });

  it('keeps a 15-digit value that fails the check digit out of the load path only', () => {
    expect(imeiFormatError('352098117744521')).toBeNull();
    expect(imeiPassesLuhn('352098117744521')).toBe(false);
    expect(imeiLoadError('352098117744521')).toBe(IMEI_LUHN_MESSAGE);
    expect(imeiLoadError('')).toBeNull();
  });
});
