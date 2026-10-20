import { extractImei } from '../../lib/device-scan';
import { imeiPassesLuhn } from '../../lib/imei';
import type { Crop } from './camera-profile';

export const SCAN_FORMATS = ['code_128', 'ean_13', 'qr_code'] as const;

export type ScanHit = { rawValue?: string | null; format?: string | null };

type ZxingHintApi = {
  DecodeHintType: { POSSIBLE_FORMATS: unknown; TRY_HARDER: unknown };
  BarcodeFormat: { CODE_128: unknown; EAN_13: unknown; QR_CODE: unknown };
};

export function rawHasImei(raw: string | null | undefined) {
  if (!raw) return false;
  const imei = extractImei(raw);
  return Boolean(imei && imeiPassesLuhn(imei));
}

function normalizeFormat(format?: string | null) {
  return (format ?? '').toLowerCase().replace(/[\s-]/g, '_');
}

function isEan13(hit: ScanHit, raw: string) {
  const format = normalizeFormat(hit.format);
  if (format === 'ean_13' || format === 'ean13') return true;
  return /^\d{13}$/.test(raw);
}

/** Prefer a 15-digit Luhn IMEI (Code 128 on the box) and ignore a sibling EAN-13. */
export function selectBarcodeRaw(hits: ScanHit[]): string | null {
  const rows = hits
    .map((hit) => ({ hit, raw: (hit.rawValue ?? '').replace(/\u001d/g, ' ').trim() }))
    .filter((row) => row.raw.length > 0);
  if (rows.length === 0) return null;
  const imeiHits = rows.filter((row) => rawHasImei(row.raw));
  if (imeiHits.length > 0) {
    const code128 = imeiHits.find((row) => normalizeFormat(row.hit.format) === 'code_128');
    const qr = imeiHits.find((row) => normalizeFormat(row.hit.format) === 'qr_code');
    return (code128 ?? qr ?? imeiHits[0]).raw;
  }
  return rows.find((row) => !isEan13(row.hit, row.raw))?.raw ?? null;
}

export function buildZxingHints(zxing: ZxingHintApi) {
  const hints = new Map<unknown, unknown>();
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.CODE_128,
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.QR_CODE,
  ]);
  hints.set(zxing.DecodeHintType.TRY_HARDER, true);
  return hints;
}

/** Full frame plus overlapping halves, in source pixels, so a wide label can yield both symbols. */
export function zxingRegions(width: number, height: number): Crop[] {
  if (width < 8 || height < 8) return [];
  const full: Crop = { sx: 0, sy: 0, sw: width, sh: height };
  if (width < 48) return [full];
  const span = Math.round(width * 0.62);
  return [
    full,
    { sx: 0, sy: 0, sw: span, sh: height },
    { sx: width - span, sy: 0, sw: span, sh: height },
  ];
}
