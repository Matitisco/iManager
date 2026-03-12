import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
