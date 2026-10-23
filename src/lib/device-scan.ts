import { lookupPartNumber } from './apple-part-numbers';
import { imeiPassesLuhn } from './imei';
import { imeiSpecs } from './imei-tac';

export type ParsedDeviceCode = {
  imei: string | null;
  serial: string | null;
  partNumber: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  /** A box label carries a part number or a serial besides the IMEI. */
  rich: boolean;
};

const PART_PATTERN = /\b([A-Z][A-Z0-9]{4}[A-Z]{1,2}\/[A-Z])\b/i;

function luhnWindow(digits: string): string | null {
  if (digits.length < 15) return null;
  for (let index = 0; index + 15 <= digits.length; index += 1) {
    const slice = digits.slice(index, index + 15);
    if (imeiPassesLuhn(slice)) return slice;
  }
  return null;
}

/** First 15-digit IMEI that passes Luhn, including the spaced 2-6-6-1 box format. */
export function extractImei(raw: string): string | null {
  const text = raw.replace(/\u001d/g, ' ');
  const spaced = text.match(/(\d{2})\s+(\d{6})\s+(\d{6})\s+(\d)/);
  if (spaced) {
    const joined = `${spaced[1]}${spaced[2]}${spaced[3]}${spaced[4]}`;
    if (imeiPassesLuhn(joined)) return joined;
  }
  const runs = text.match(/\d{15,}/g) ?? [];
  for (const run of runs) {
    const found = luhnWindow(run);
    if (found) return found;
  }
  return luhnWindow(text.replace(/\D/g, ''));
}

/** First 15-digit run, used when an existing stock code may not pass Luhn. */
export function extractImeiLoose(raw: string): string | null {
  return extractImei(raw) ?? raw.match(/\d{15}/)?.[0] ?? null;
}

function extractSerial(text: string, partNumber: string | null, imei: string | null): string | null {
  const hidden = text
    .replace(partNumber ?? '', ' ')
    .replace(imei ?? '', ' ');
  const tokens = hidden.match(/\b[A-Z0-9]{10,12}\b/gi) ?? [];
  return tokens.find((token) => /[A-Z]/i.test(token) && /\d/.test(token)) ?? null;
}

export function parseDeviceCode(raw: string): ParsedDeviceCode {
  const text = raw.replace(/\u001d/g, ' ').trim();
  const partMatch = text.match(PART_PATTERN);
  const partNumber = partMatch ? partMatch[1].toUpperCase() : null;
  const imei = extractImei(text);
  const serial = extractSerial(text, partNumber, imei);
  const part = partNumber ? lookupPartNumber(partNumber) : null;
  return {
    imei,
    serial,
    partNumber,
    model: part?.model ?? (imei ? imeiSpecs(imei)?.model : null) ?? null,
    capacity: part?.capacity ?? null,
    color: part?.color ?? null,
    rich: Boolean(partNumber || serial),
  };
}
