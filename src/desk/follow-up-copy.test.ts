import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';
import { followUpAside, followUpFact, followUpMessage, followUpTodayLabel, followUpWhen } from './follow-up-copy';
import type { FollowUpCard, FollowUpSettings } from '../services/accounts-api';

const show = (amount: number, currency: string | null) => formatMoney(amount, currency === 'USD' ? 'USD' : 'ARS');
const settings: FollowUpSettings = {
  birthdayLeadDays: 7,
  warrantyMonths: 12,
  warrantyLeadDays: 15,
  inactiveDays: 180,
  includeDebts: true,
};

function card(partial: Partial<FollowUpCard> & Pick<FollowUpCard, 'kind'>): FollowUpCard {
  return {
    id: partial.kind,
    clientId: 'c',
    name: 'Lucía',
    phone: '1162007525',
    title: 'ignorar',
    detail: 'TEXTO VIEJO QUE NO DEBE USARSE',
    amount: null,
    dueDate: null,
    lastPurchaseAt: null,
    warrantyEndsAt: null,
    deviceLabel: null,
    currency: null,
    installmentSequence: null,
    installmentCount: null,
    birthdayOn: null,
    turningAge: null,
    warrantyDays: null,
    ...partial,
  };
}

describe('textos de seguimientos', () => {
  it('arma el dato clave desde los campos y no desde el detalle', () => {
    expect(followUpFact(card({
      kind: 'DEUDA',
      amount: 640000,
      currency: 'ARS',
      dueDate: '2026-10-02',
    }), '2026-10-18', show)).toEqual({ primary: '$ 640.000', secondary: 'Debe desde el 02/10', debt: true });
    expect(followUpFact(card({
      kind: 'DEUDA',
      amount: 420000,
      dueDate: '2026-10-20',
      installmentSequence: 2,
      installmentCount: 3,
    }), '2026-10-18', show).secondary).toBe('Cuota 2 de 3 · vence 20/10');
    expect(followUpFact(card({
      kind: 'CUMPLEANOS',
      birthdayOn: '2026-10-19',
    }), '2026-10-18', show)).toMatchObject({ primary: 'Mañana', secondary: 'Cumple el 19/10' });
    expect(followUpFact(card({
      kind: 'CUMPLEANOS',
      birthdayOn: '2026-10-22',
      turningAge: 30,
    }), '2026-10-18', show)).toMatchObject({ primary: 'Jue 22/10', secondary: 'Cumple 30' });
    expect(followUpFact(card({
      kind: 'GARANTIA',
      warrantyEndsAt: '2026-10-24',
      deviceLabel: 'iPhone 13 128GB',
      warrantyDays: 60,
    }), '2026-10-18', show)).toEqual({ primary: 'Vence 24/10', secondary: 'iPhone 13 128GB · 60 días', debt: false });
    expect(followUpFact(card({
      kind: 'INACTIVO',
      lastPurchaseAt: '2026-04-09',
      deviceLabel: 'iPhone 11',
    }), '2026-10-18', show)).toEqual({ primary: '09/04/2026', secondary: 'Última compra · iPhone 11', debt: false });
    expect(followUpFact(card({ kind: 'DEUDA', amount: 10, dueDate: '2026-10-02' }), '2026-10-18', show).primary).not.toContain('TEXTO VIEJO');
  });

  it('resume cada grupo con el total o la ventana', () => {
    expect(followUpTodayLabel('2026-10-18')).toBe('dom 18/10');
    expect(followUpWhen('2026-10-18', '2026-10-18')).toBe('Hoy');
    const birthdays = [
      card({ kind: 'CUMPLEANOS', birthdayOn: '2026-10-19' }),
      card({ kind: 'CUMPLEANOS', birthdayOn: '2026-10-23' }),
    ];
    expect(followUpAside({ kind: 'CUMPLEANOS', settings, cards: birthdays, today: '2026-10-18', totalAmount: null, currency: null, show })).toBe('esta semana');
    expect(followUpAside({ kind: 'DEUDA', settings, cards: [], today: '2026-10-18', totalAmount: 1285000, currency: 'ARS', show })).toBe('$ 1.285.000 en total');
    expect(followUpAside({ kind: 'GARANTIA', settings, cards: [], today: '2026-10-18', totalAmount: null, currency: null, show })).toBe('próximos 15 días');
    expect(followUpAside({ kind: 'INACTIVO', settings, cards: [], today: '2026-10-18', totalAmount: null, currency: null, show })).toBe('más de 180 días');
    expect(followUpAside({ kind: 'DEUDA', settings, cards: [], today: '2026-10-18', totalAmount: null, currency: null, show })).toBe('');
  });

  it('escribe el mensaje con los campos del cliente', () => {
    const cardDebt = card({ kind: 'DEUDA', name: 'Lucía Fernández', detail: 'Lucía Fernández tiene saldo' });
    expect(followUpMessage(cardDebt)).toBe('Hola Lucía Fernández, te escribo por el saldo pendiente.');
    expect(followUpMessage(cardDebt)).not.toContain('tiene saldo');
    expect(followUpMessage(card({ kind: 'GARANTIA', name: 'Diego', deviceLabel: 'iPhone 13 128GB' }))).toContain('iPhone 13 128GB');
  });
});
