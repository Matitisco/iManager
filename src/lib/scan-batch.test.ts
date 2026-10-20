import { describe, expect, it } from 'vitest';
import { batchCounts, classifyScannedImei, frequentModels, loadButtonLabel, rowSummary } from './scan-batch';

const imei = '352098117744522';

describe('batch classification', () => {
  it('blocks an invalid IMEI, a repeat and a device already in stock', () => {
    expect(classifyScannedImei('123', { valid: false, earlierImeis: [], stock: [] }).message).toBe('IMEI inválido · no se carga');
    expect(classifyScannedImei(imei, { valid: true, earlierImeis: [imei], stock: [] })).toMatchObject({ kind: 'duplicate', loadable: false });
    expect(classifyScannedImei(imei, { valid: true, earlierImeis: [], stock: [{ imei, status: 'DISPONIBLE' }] })).toMatchObject({ kind: 'in-stock', loadable: false });
  });

  it('warns and still loads a sold or archived IMEI', () => {
    expect(classifyScannedImei(imei, { valid: true, earlierImeis: [], stock: [{ imei, status: 'VENDIDO' }] })).toMatchObject({
      loadable: true,
      message: 'Ya estuvo en stock (vendido) · se carga igual',
    });
    expect(classifyScannedImei(imei, { valid: true, earlierImeis: [], stock: [{ imei, status: 'DISPONIBLE', archivedAt: '2026-01-01' }] }).loadable).toBe(true);
  });

  it('counts loadable rows and names the button', () => {
    const rows = [
      classifyScannedImei(imei, { valid: true, earlierImeis: [], stock: [] }),
      classifyScannedImei('353911220588306', { valid: true, earlierImeis: [], stock: [{ imei: '353911220588306', status: 'VENDIDO' }] }),
      classifyScannedImei('111', { valid: false, earlierImeis: [], stock: [] }),
    ];
    expect(batchCounts(rows)).toEqual({ scanned: 3, loadable: 2, warnings: 1 });
    expect(loadButtonLabel(1)).toBe('Cargar 1 equipo');
    expect(loadButtonLabel(4)).toBe('Cargar 4 equipos');
  });

  it('says when the operator changed color or battery', () => {
    const ready = classifyScannedImei(imei, { valid: true, earlierImeis: [], stock: [] });
    expect(rowSummary({ classification: ready, color: 'Medianoche', battery: '86', editedColor: false, editedBattery: false })).toBe('Lista · Medianoche · bat. 86 %');
    expect(rowSummary({ classification: ready, color: 'Azul', battery: '91', editedColor: true, editedBattery: true })).toBe('Lista · cambiaste color y batería');
  });

  it('lists the models the store loads most, then the catalog', () => {
    expect(frequentModels(
      [{ model: 'iPhone 13' }, { model: 'iPhone 13' }, { model: 'iPhone 11' }],
      ['iPhone 15', 'iPhone 13'],
      3,
    )).toEqual(['iPhone 13', 'iPhone 11', 'iPhone 15']);
  });
});
