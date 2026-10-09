import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isTechnicalMessage, readApiErrorMessage } from "./api-message"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCompactNumber(number: number, isCurrency: boolean = false): string {
  let formatted = '';
  if (number >= 1000000) {
    formatted = (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (number >= 1000) {
    formatted = (number / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  } else {
    formatted = number.toString();
  }
  
  // Use dot as decimal separator for compact numbers
  if (!formatted.includes('k') && !formatted.includes('M')) {
    // Format regular numbers with dots for thousands
    formatted = number.toLocaleString('es-AR');
  }
  
  return isCurrency ? `$${formatted}` : formatted;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function trimToString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') {
    return messageFromText(error, fallback);
  }

  if (error instanceof Error) {
    return messageFromText(error.message, fallback);
  }

  if (error && typeof error === 'object') {
    return readApiErrorMessage(error, fallback);
  }

  return fallback;
}

function messageFromText(value: string, fallback: string): string {
  const parsed = parseErrorPayload(value);
  if (parsed !== undefined) return readApiErrorMessage(parsed, fallback);
  if (!value.trim() || isTechnicalMessage(value)) return fallback;
  return value;
}

function parseErrorPayload(value: string): unknown | undefined {
  const text = value.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
