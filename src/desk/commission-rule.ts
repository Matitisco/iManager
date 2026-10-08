import { formatMoney } from './format';
import type { CommissionBasis } from '../services/commissions-api';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function periodChoices(now = new Date(), count = 12) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let year = Number(bag.year);
  let month = Number(bag.month);
  const options: { key: string; label: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    options.push({ key: `${year}-${String(month).padStart(2, '0')}`, label: `${MONTHS[month - 1]} ${year}` });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return options;
}

export function shareLabel(share: number) {
  const value = Number.isFinite(share) ? share : 0;
  return `${value.toFixed(1).replace('.', ',')}% de lo vendido`;
}

export function paidLabel(iso: string) {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
  return `Pagada ${text}`;
}

export function commissionPreview(basis: CommissionBasis, rate: number, includeAccessories: boolean) {
  const safe = Number.isFinite(rate) ? rate : 0;
  if (basis === 'FIXED_PER_DEVICE') {
    return `En una venta de $ 650.000, le corresponden ${formatMoney(safe)}`;
  }
  if (basis === 'PERCENT_PROFIT') {
    const amount = Math.round((150000 * safe) / 100);
    const extra = includeAccessories ? ' Los accesorios suman a la ganancia.' : '';
    return `Sobre $ 150.000 de ganancia, le corresponden ${formatMoney(amount)}.${extra}`;
  }
  const amount = Math.round((650000 * safe) / 100);
  const extra = includeAccessories ? ' Los accesorios entran en ese total.' : '';
  return `En una venta de $ 650.000, le corresponden ${formatMoney(amount)}.${extra}`;
}

export function parseCommissionRate(basis: CommissionBasis, text: string) {
  if (basis === 'FIXED_PER_DEVICE') {
    const digits = text.replace(/\D/g, '').slice(0, 12);
    return digits ? Number(digits) : 0;
  }
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}
