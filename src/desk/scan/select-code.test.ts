import { describe, expect, it } from 'vitest';
import { buildZxingHints, SCAN_FORMATS, selectBarcodeRaw, zxingRegions } from './select-code';

const IMEI = '355150550080984';
const EAN = '8806094745610';

describe('barcode selection', () => {
  it('keeps the 15-digit luhn imei and ignores the ean-13 on the same label', () => {
    expect(selectBarcodeRaw([
      { rawValue: EAN, format: 'ean_13' },
      { rawValue: IMEI, format: 'code_128' },
    ])).toBe(IMEI);
    expect(selectBarcodeRaw([
      { rawValue: IMEI, format: 'CODE_128' },
      { rawValue: EAN, format: 'EAN_13' },
    ])).toBe(IMEI);
  });

  it('does not treat a lone ean-13 as an imei', () => {
    expect(selectBarcodeRaw([{ rawValue: EAN, format: 'ean_13' }])).toBeNull();
    expect(selectBarcodeRaw([{ rawValue: EAN }])).toBeNull();
  });

  it('still returns a non-ean code that is not an imei', () => {
    expect(selectBarcodeRaw([
      { rawValue: EAN, format: 'ean_13' },
      { rawValue: 'F2LXK9POQ1', format: 'qr_code' },
    ])).toBe('F2LXK9POQ1');
  });

  it('reads an imei embedded in a qr next to an ean', () => {
    expect(selectBarcodeRaw([
      { rawValue: EAN, format: 'ean_13' },
      { rawValue: `SM-S911B ${IMEI}`, format: 'qr_code' },
    ])).toBe(`SM-S911B ${IMEI}`);
  });
});

describe('zxing fallback hints', () => {
  it('asks for code 128, ean-13 and qr with try_harder', () => {
    const zxing = {
      DecodeHintType: { POSSIBLE_FORMATS: 'formats', TRY_HARDER: 'try' },
      BarcodeFormat: { CODE_128: 'code_128', EAN_13: 'ean_13', QR_CODE: 'qr_code' },
    };
    const hints = buildZxingHints(zxing);
    expect(hints.get('try')).toBe(true);
    expect(hints.get('formats')).toEqual(['code_128', 'ean_13', 'qr_code']);
    expect(SCAN_FORMATS).toEqual(['code_128', 'ean_13', 'qr_code']);
  });

  it('splits a wide frame in source pixels without scaling it down', () => {
    const regions = zxingRegions(640, 240);
    expect(regions[0]).toEqual({ sx: 0, sy: 0, sw: 640, sh: 240 });
    expect(regions[1].sw).toBe(Math.round(640 * 0.62));
    expect(regions[1].sh).toBe(240);
    expect(regions[2].sx + regions[2].sw).toBe(640);
    expect(regions.every((region) => region.sw <= 640 && region.sh === 240)).toBe(true);
  });
});
