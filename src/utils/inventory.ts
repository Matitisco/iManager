/**
 * Extracts the minimum numeric battery value from a raw batteryHealth string.
 * Handles: "87", "87%", "83-85%", 0.87 (decimal fraction), undefined/null.
 */
export function extractMinBattery(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 100;
  const sVal = String(val).trim();
  const numVal = parseFloat(sVal);
  if (!isNaN(numVal) && numVal > 0 && numVal < 1 && !sVal.includes('-')) {
    return Math.round(numVal * 100);
  }
  const match = sVal.match(/\d+/);
  return match ? parseInt(match[0], 10) : 100;
}

/**
 * Formats a batteryHealth value for display.
 * Returns the value with a "%" suffix; range strings like "83-85%" pass through.
 */
export function formatBatteryDisplay(val: string | number): string {
  const sVal = String(val);
  const minVal = extractMinBattery(val);
  if (sVal.includes('%')) return sVal;
  if (parseFloat(sVal) < 1 && !sVal.includes('-')) return `${minVal}%`;
  return `${sVal}%`;
}
