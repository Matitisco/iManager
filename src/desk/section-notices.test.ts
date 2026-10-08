import { describe, expect, it } from 'vitest';
import type { OperationNotification } from '../services/operations-api';
import { fallbackNoticeReason, mergePinned, novedadesLabel, rowsForNotice } from './section-notices';

function note(partial: Partial<OperationNotification> & Pick<OperationNotification, 'id' | 'section' | 'title' | 'message'>): OperationNotification {
  return {
    storeId: 's',
    kind: 'INTEGRATED_OPERATION',
    createdAt: '2026-10-08T12:00:00.000Z',
    readAt: null,
    ...partial,
  };
}

describe('section notice reasons', () => {
  it('labels the examples from the section copy when the record id was already stored', () => {
    expect(fallbackNoticeReason(note({ id: '1', section: 'inventory', title: 'Equipo recibido', message: 'Entró un iPhone 11 por canje, en revisión' }))).toBe('Nuevo · entró por canje');
    expect(fallbackNoticeReason(note({ id: '2', section: 'inventory', title: 'Equipo vendido', message: 'iPhone 13 vendido' }))).toBe('Vendido');
    expect(fallbackNoticeReason(note({ id: '3', section: 'clients', title: 'Nuevo cliente', message: 'Nuevo cliente: Juan Pérez' }))).toBe('Nuevo cliente');
    expect(fallbackNoticeReason(note({ id: '4', section: 'clients', title: 'Saldo pendiente', message: 'Juan Pérez debe $ 50.000' }))).toBe('Debe $ 50.000');
    expect(novedadesLabel(1)).toBe('1 novedad');
    expect(novedadesLabel(2)).toBe('2 novedades');
  });

  it('uses stored targets so one inventory notice can highlight the sold phone and the trade-in', () => {
    const rows = rowsForNotice(note({
      id: 'n',
      section: 'inventory',
      title: 'Stock actualizado',
      message: 'iPhone 14 vendido. Entró un iPhone 11 por canje, en revisión',
      recordId: 'received',
      targets: [
        { recordId: 'sold', reason: 'Vendido' },
        { recordId: 'received', reason: 'Nuevo · entró por canje' },
      ],
    }));
    expect(mergePinned([], [note({
      id: 'n',
      section: 'inventory',
      title: 'Stock actualizado',
      message: 'junto',
      targets: rows.map((row) => ({ recordId: row.recordId, reason: row.reason })),
    })])).toEqual([
      { recordId: 'sold', reason: 'Vendido', notificationIds: ['n'] },
      { recordId: 'received', reason: 'Nuevo · entró por canje', notificationIds: ['n'] },
    ]);
  });
});
