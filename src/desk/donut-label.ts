import { formatMoney, formatMoneyCompact } from './format';

// 2 * (radius 46 - half the 20px stroke) = 72px; leave 4px per side.
export const DONUT_LABEL_WIDTH = 64;
const MIN_FONT_SIZE = 11;

/** Conservative DM Sans bold advance estimate, in em; no DOM measurement needed. */
export function donutTextWidth(text: string, fontSize: number, phone = false): number {
  const units = Array.from(text).reduce((sum, char) => {
    const advance = /[0-9]/.test(char) ? 0.62 : /[\s.,]/.test(char) ? 0.3 : /[M%—]/.test(char) ? 1 : 0.8;
    return sum + advance;
  }, 0);
  // The existing phone style uses -0.03em letter spacing.
  return Math.max(0, units - (phone ? text.length * 0.03 : 0)) * fontSize;
}

export function fitDonutText(text: string, phone = false, compact?: () => string) {
  const maxSize = phone ? 13 : 18;
  const sizeFor = (label: string) => Math.min(maxSize, DONUT_LABEL_WIDTH / (donutTextWidth(label, 1, phone) || 1));
  let fontSize = sizeFor(text);
  if (fontSize < MIN_FONT_SIZE && compact) {
    text = compact();
    fontSize = sizeFor(text);
  }
  // Round down so rounding cannot push text beyond the budget.
  return { text, fontSize: Math.floor(fontSize * 100) / 100 };
}

function compactDonutNumber(value: number): string {
  const magnitude = Math.abs(value);
  // Keep even extreme finite totals short; normal business amounts use k/M.
  if (magnitude >= 1e12) return value.toExponential(0).replace('e+', 'e');
  const millions = magnitude >= 999_950;
  const divisor = millions ? 1e6 : 1e3;
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value / divisor)}${millions ? 'M' : 'k'}`;
}

export function fitDonutValue(value: number, currency?: 'ARS' | 'USD', phone = false) {
  const amount = Number.isFinite(value) ? value : 0;
  const fullText = currency ? formatMoney(amount, currency) : String(amount);
  const initial = currency ? formatMoneyCompact(amount, currency) : fullText;
  const prefix = currency ? `${currency === 'USD' ? 'US$' : '$'} ` : '';
  return {
    ...fitDonutText(initial, phone, () => `${prefix}${compactDonutNumber(amount)}`),
    fullText,
  };
}
