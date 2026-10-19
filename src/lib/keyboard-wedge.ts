import { extractImei } from './device-scan';

export type WedgePush =
  | { type: 'char' }
  | { type: 'scan'; value: string }
  | { type: 'enter' };

const PART_PATTERN = /[A-Z][A-Z0-9]{4}[A-Z]{1,2}\/[A-Z]/i;

/**
 * USB and Bluetooth scanners type a burst and finish with Enter.
 * A human pause resets the burst, so a slow IMEI stays a normal Enter.
 */
export function createWedgeBuffer(gapMs = 80) {
  let buffer = '';
  let last = 0;

  return {
    push(key: string, now = Date.now()): WedgePush {
      if (key === 'Enter') {
        const value = buffer;
        const elapsed = last ? now - last : gapMs + 1;
        buffer = '';
        const burst = value.length >= 8 && elapsed <= 800 && elapsed <= gapMs * 10;
        if (burst && (extractImei(value) || PART_PATTERN.test(value))) return { type: 'scan', value };
        last = 0;
        return { type: 'enter' };
      }
      if (key.length !== 1) return { type: 'char' };
      if (last && now - last > gapMs) buffer = '';
      buffer += key;
      last = now;
      return { type: 'char' };
    },
  };
}

export function focusNextControl(current: HTMLElement) {
  const root = current.closest('.sheet, form, .dscreen') ?? document.body;
  const controls = [...root.querySelectorAll<HTMLElement>('input, select, textarea')].filter((control) => {
    if (control === current) return true;
    if ((control as HTMLInputElement).disabled) return false;
    if (control.tabIndex < 0) return false;
    return control.getClientRects().length > 0;
  });
  const index = controls.indexOf(current);
  controls[index + 1]?.focus();
}
