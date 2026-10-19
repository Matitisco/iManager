import type { FollowUpCard, FollowUpKind, FollowUpSettings } from '../services/accounts-api';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const FOLLOW_UP_ORDER: FollowUpKind[] = ['DEUDA', 'CUMPLEANOS', 'GARANTIA', 'INACTIVO'];

export const FOLLOW_UP_LABEL: Record<FollowUpKind, { chip: string; group: string; badge: string }> = {
  DEUDA: { chip: 'Deudas', group: 'Deudas', badge: 'Deuda' },
  CUMPLEANOS: { chip: 'Cumpleaños', group: 'Cumpleaños', badge: 'Cumpleaños' },
  GARANTIA: { chip: 'Garantías', group: 'Garantías por vencer', badge: 'Garantía por vencer' },
  INACTIVO: { chip: 'Hace tiempo', group: 'Hace tiempo no compran', badge: 'Hace tiempo no compra' },
};

function parts(ymd: string) {
  const [year, month, day] = ymd.split('-');
  return { year, month, day };
}

export function addDaysYmd(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayMonth(ymd: string) {
  const { month, day } = parts(ymd);
  return `${day}/${month}`;
}

export function fullDate(ymd: string) {
  const { year, month, day } = parts(ymd);
  return `${day}/${month}/${year}`;
}

function weekday(ymd: string) {
  const date = new Date(`${ymd}T12:00:00Z`);
  return WEEKDAYS[date.getUTCDay()] ?? '';
}

export function followUpTodayLabel(ymd: string) {
  return `${weekday(ymd)} ${dayMonth(ymd)}`;
}

export function followUpWeekdayLabel(ymd: string) {
  const name = weekday(ymd);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${dayMonth(ymd)}`;
}

export function followUpWhen(ymd: string, today: string) {
  if (ymd === today) return 'Hoy';
  if (ymd === addDaysYmd(today, 1)) return 'Mañana';
  return followUpWeekdayLabel(ymd);
}

export function followUpClientsLabel(count: number) {
  return count === 1 ? '1 cliente' : `${count} clientes`;
}

export function followUpMessage(card: Pick<FollowUpCard, 'kind' | 'name' | 'deviceLabel'>) {
  if (card.kind === 'CUMPLEANOS') return `Hola ${card.name}, ¡feliz cumpleaños!`;
  if (card.kind === 'GARANTIA') {
    const device = card.deviceLabel ? ` de ${card.deviceLabel}` : '';
    return `Hola ${card.name}, te escribo porque se acerca el vencimiento de la garantía${device}.`;
  }
  if (card.kind === 'DEUDA') return `Hola ${card.name}, te escribo por el saldo pendiente.`;
  return `Hola ${card.name}, hace un tiempo que no nos vemos. ¿Te ayudo con algo?`;
}

export function followUpFact(
  card: FollowUpCard,
  today: string,
  show: (amount: number, currency: string | null) => string,
): { primary: string; secondary: string; debt: boolean } {
  if (card.kind === 'DEUDA') {
    const secondary = card.installmentSequence && card.installmentCount && card.dueDate
      ? `Cuota ${card.installmentSequence} de ${card.installmentCount} · vence ${dayMonth(card.dueDate)}`
      : card.dueDate ? `Debe desde el ${dayMonth(card.dueDate)}` : '';
    return { primary: card.amount == null ? '' : show(card.amount, card.currency), secondary, debt: true };
  }
  if (card.kind === 'CUMPLEANOS' && card.birthdayOn) {
    const secondary = card.turningAge ? `Cumple ${card.turningAge}` : `Cumple el ${dayMonth(card.birthdayOn)}`;
    return { primary: followUpWhen(card.birthdayOn, today), secondary, debt: false };
  }
  if (card.kind === 'GARANTIA' && card.warrantyEndsAt) {
    const bits = [card.deviceLabel, card.warrantyDays != null ? `${card.warrantyDays} días` : null].filter(Boolean);
    return { primary: `Vence ${dayMonth(card.warrantyEndsAt)}`, secondary: bits.join(' · '), debt: false };
  }
  if (card.kind === 'INACTIVO' && card.lastPurchaseAt) {
    return {
      primary: fullDate(card.lastPurchaseAt),
      secondary: card.deviceLabel ? `Última compra · ${card.deviceLabel}` : 'Última compra',
      debt: false,
    };
  }
  return { primary: '', secondary: '', debt: false };
}

function daysBetween(older: string, newer: string) {
  const start = Date.parse(`${older}T00:00:00Z`);
  const end = Date.parse(`${newer}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function followUpAside(input: {
  kind: FollowUpKind;
  settings: FollowUpSettings;
  cards: FollowUpCard[];
  today: string;
  totalAmount: number | null;
  currency: string | null;
  show: (amount: number, currency: string | null) => string;
}) {
  if (input.kind === 'DEUDA') {
    return input.totalAmount == null ? '' : `${input.show(input.totalAmount, input.currency)} en total`;
  }
  if (input.kind === 'CUMPLEANOS') {
    const dates = input.cards.map((card) => card.birthdayOn).filter((value): value is string => Boolean(value));
    if (!dates.length) return '';
    const furthest = dates.reduce((max, value) => (value > max ? value : max));
    const span = daysBetween(input.today, furthest);
    if (span <= 0) return 'hoy';
    if (span <= 7) return 'esta semana';
    return `próximos ${span} días`;
  }
  if (input.kind === 'GARANTIA') {
    const days = input.settings.warrantyLeadDays;
    if (days <= 0) return 'hoy';
    if (days === 1) return 'hasta mañana';
    return `próximos ${days} días`;
  }
  return `más de ${input.settings.inactiveDays} días`;
}
