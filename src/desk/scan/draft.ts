import { parseDeviceCode, type ParsedDeviceCode } from '../../lib/device-scan';
import { lookupPartNumber } from '../../lib/apple-part-numbers';
import { autofillImeiSpecs } from '../../lib/report-unknown-tac';

export type ScanFieldKey = 'model' | 'capacity' | 'color' | 'imei' | 'serial' | 'partNumber';

export type ScanDraft = {
  imei: string;
  serial: string;
  partNumber: string;
  model: string;
  capacity: string;
  color: string;
  battery: string;
  condition: string;
  cost: string;
  price: string;
  notes: string;
  detected: Record<ScanFieldKey, boolean>;
  touched: Record<ScanFieldKey, boolean>;
};

const EMPTY_FLAGS: Record<ScanFieldKey, boolean> = {
  model: false,
  capacity: false,
  color: false,
  imei: false,
  serial: false,
  partNumber: false,
};

export function draftFromCode(
  parsed: ParsedDeviceCode,
  carry?: Partial<Pick<ScanDraft, 'battery' | 'condition' | 'price' | 'cost' | 'notes'>>,
): ScanDraft {
  if (parsed.imei) autofillImeiSpecs(parsed.imei);
  return {
    imei: parsed.imei ?? '',
    serial: parsed.serial ?? '',
    partNumber: parsed.partNumber ?? '',
    model: parsed.model ?? '',
    capacity: parsed.capacity ?? '',
    color: parsed.color ?? '',
    battery: carry?.battery ?? '',
    condition: carry?.condition ?? '',
    cost: carry?.cost ?? '',
    price: carry?.price ?? '',
    notes: carry?.notes ?? '',
    detected: {
      model: Boolean(parsed.model),
      capacity: Boolean(parsed.capacity),
      color: Boolean(parsed.color),
      imei: Boolean(parsed.imei),
      serial: Boolean(parsed.serial),
      partNumber: Boolean(parsed.partNumber),
    },
    touched: { ...EMPTY_FLAGS },
  };
}

export function draftFromImei(imei: string): ScanDraft {
  return draftFromCode(parseDeviceCode(imei));
}

export function boxLabel(draft: ScanDraft) {
  return draft.detected.partNumber || draft.detected.serial;
}

export function editScanField(draft: ScanDraft, key: ScanFieldKey, value: string): ScanDraft {
  const next = { ...draft, [key]: value, touched: { ...draft.touched, [key]: true } };
  const specs = key === 'imei' ? autofillImeiSpecs(value) : null;
  if (key !== 'imei' || draft.touched.model || (draft.model.trim() && !draft.detected.model)) return next;
  const model = lookupPartNumber(draft.partNumber)?.model ?? specs?.model;
  if (!model) return next;
  return { ...next, model, detected: { ...next.detected, model: true } };
}

export function detectedWasEdited(draft: ScanDraft) {
  return (Object.keys(draft.detected) as ScanFieldKey[]).some((key) => draft.detected[key] && draft.touched[key]);
}
