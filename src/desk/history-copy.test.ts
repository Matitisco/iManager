import { describe, expect, it } from 'vitest';
import { groupHistoryDays, historyAction, historyDetailRows, historyRecord, historyRecordAction, historyRecordNote, historySentence } from './history-copy';

describe('history copy', () => {
  it.each([
    ['RECIBIDO', 'Recibido'], ['EN_REPARACION', 'En reparación'],
    ['LISTO_PARA_RETIRAR', 'Listo para retirar'], ['ENTREGADO', 'Entregado'],
    ['EN_DIAGNOSTICO', 'En diagnóstico'], ['Garantía especial', 'Garantía especial'],
  ])('names repair status %s in Spanish and preserves custom labels', (status, label) => {
    const event = { action: 'repair.status', changes: [{ label: 'Estado', before: 'RECIBIDO', after: status }] };
    expect(historyRecordAction(event)).toBe(`Pasó a ${label}`);
    expect(historyDetailRows(event)).toEqual([{ label: 'Estado', before: 'Recibido', after: label }]);
    expect(historyDetailRows({ ...event, action: 'repair.created', changes: [{ label: 'Estado', before: null, after: status }] }))
      .toEqual([{ label: 'Estado', before: null, after: label }]);
  });

  it('preserves status wording for other entities and handles older audits without a status', () => {
    expect(historyRecordAction({ action: 'repair.status', verb: 'cambió el estado de', target: 'OT-0001' })).toBe('cambió el estado de OT-0001');
    expect(historyDetailRows({ action: 'repair.archived', changes: [{ label: 'Estado', before: 'Activa', after: 'Archivada' }] }))
      .toEqual([{ label: 'Estado', before: 'Activa', after: 'Archivada' }]);
  });
  it('writes a complete seller sentence and only relies on layout for overflow', () => {
    const event = { actorName: 'Matias Tiscornia', verb: 'cambió el vendedor de', target: 'V-0190', suffix: '' };
    expect(historyAction(event)).toBe('cambió el vendedor de V-0190');
    expect(historySentence(event)).toBe('Matias Tiscornia cambió el vendedor de V-0190');
    expect(historySentence(event).includes('…')).toBe(false);
  });

  it('names a legacy delete and stays neutral when the object is missing', () => {
    expect(historyAction({ verb: 'eliminó', target: 'iPhone 13 (antes del historial)' })).toBe('eliminó iPhone 13 (antes del historial)');
    expect(historyAction({ verb: 'eliminó', target: 'un registro (antes del historial)' })).toBe('eliminó un registro (antes del historial)');
    expect(historyAction({ verb: 'abrió', target: 'una caja' })).toBe('abrió una caja');
    expect(historyAction({ verb: 'actualizó', target: 'un registro' })).toBe('actualizó un registro');
  });

  it.each(['Ocultar: 1 equipo', '100 → 200', 'Precio: 200', 'Actualizó el equipo'])('never infers before/after from free text: %s', detail => {
    expect(historyDetailRows({ changes: [], detail })).toEqual([]);
  });

  it('keeps structured changes including a genuinely missing value', () => {
    expect(historyDetailRows({ changes: [
      { label: 'Estado', before: 'Activo', after: 'Archivado' },
      { label: 'Nota', before: null, after: 'Revisar' },
      { label: 'Vacío', before: null, after: null },
    ] })).toEqual([
      { label: 'Estado', before: 'Activo', after: 'Archivado' },
      { label: 'Nota', before: null, after: 'Revisar' },
    ]);
  });

  it('separates the historical label and identifier without inventing missing digits', () => {
    expect(historyRecord({ entityLabel: 'iPhone 15 Pro 256GB · IMEI …5673', target: '' })).toEqual({ title: 'iPhone 15 Pro · 256GB', identifier: 'IMEI …5673' });
    expect(historyRecord({ entityLabel: 'iPhone 15 Pro 256GB · IMEI …5673', entityIdentifier: 'IMEI 356789012345673', target: '' }).identifier).toBe('IMEI 356789012345673');
  });

  it('conserva un único separador cuando la capacidad ya está separada en la etiqueta guardada', () => {
    expect(historyRecord({ entityLabel: 'iPhone 15 Pro · 256GB', target: '' }).title).toBe('iPhone 15 Pro · 256GB');
  });

  it('hides the record button when the record cannot be opened', () => {
    expect(historyRecordNote({ legacy: true, recordState: 'gone', section: 'sales' })).toBe('Movimiento anterior al historial: no tiene detalle');
    expect(historyRecordNote({ legacy: false, recordState: 'gone', section: 'sales' })).toBe('El registro ya no existe');
    expect(historyRecordNote({ legacy: false, recordState: 'active', section: 'cash' })).toBe('Sección temporalmente oculta');
    expect(historyRecordNote({ legacy: false, recordState: 'active', section: 'sales' })).toBeNull();
    expect(historyRecordNote({ legacy: false, recordState: 'archived', section: 'inventory' })).toBeNull();
    expect(historyRecordNote({ legacy: false, recordState: 'active', section: 'inventory', entityType: 'stockcount' })).toBe('Está en Control de stock, dentro de Inventario.');
  });
});

// These tests intentionally span UTC midnight, local midnight and year boundaries.
describe('history calendar days', () => {
  const event = (id: string, createdAt: string) => ({ id, createdAt }) as import('../services/history-api').HistoryEvent;
  it('sorts descending and groups by Argentine day, with complete dates', () => {
    const groups = groupHistoryDays([
      event('older', '2025-10-22T12:00:00Z'),
      event('midnight-utc', '2026-10-22T02:59:00Z'),
      event('today', '2026-10-22T13:42:00Z'),
      event('yesterday', '2026-10-21T15:00:00Z'),
    ], new Date('2026-10-22T14:00:00Z'));
    expect(groups.map(day => day.label)).toEqual(['Hoy · 22 oct 2026', 'Ayer · 21 oct 2026', '22 oct 2025']);
    expect(groups.map(day => day.rows.map(row => row.id))).toEqual([['today'], ['midnight-utc', 'yesterday'], ['older']]);
  });
  it('keeps yesterday in the previous year', () => {
    expect(groupHistoryDays([event('old', '2026-01-01T02:00:00Z')], new Date('2026-01-01T15:00:00Z'))[0].label).toBe('Ayer · 31 dic 2025');
  });
});
