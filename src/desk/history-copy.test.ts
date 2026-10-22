import { describe, expect, it } from 'vitest';
import { historyAction, historyDetailRows, historyRecordAction, historyRecordNote, historySentence } from './history-copy';

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

  it('turns a catalog detail into before and after rows', () => {
    expect(historyDetailRows({ changes: [], detail: 'Ocultar: 1 equipo' })).toEqual([
      { label: 'Catálogo', before: 'Visible', after: 'Oculto' },
      { label: 'Equipos', before: null, after: '1' },
    ]);
    expect(historyDetailRows({
      changes: [{ label: 'Estado', before: 'Activo', after: 'Archivado' }],
    })).toEqual([
      { label: 'Estado', before: 'Activo', after: 'Archivado' },
    ]);
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
