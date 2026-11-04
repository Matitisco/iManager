import { describe, expect, it } from 'vitest';
import { draftCatalogReason } from './draft-visibility';
import type { CatalogSettings, ManagedCatalogItem } from '../types/public-catalog';

const settings: CatalogSettings = { active: true, hideWithoutStock: true, hideReserved: true, minBattery: 80, showPrice: true, priceCurrency: 'ORIGINAL', logoUrl: null, hours: null };
const item: ManagedCatalogItem = { id: 'falso', model: 'Equipo ficticio', capacity: '128GB', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '85-90%', status: 'DISPONIBLE', cantidad: 1, catalogVisible: false, reason: 'Oculto a mano' };
describe('new catalog draft visibility', () => {
  it('ignores legacy visibility and honors only the draft exceptions', () => {
    expect(draftCatalogReason(item, settings, false)).toBeNull();
    expect(draftCatalogReason(item, settings, true)).toBe('Oculto a mano');
  });
  it.each([
    [{ status: 'RESERVADO' }, 'Regla: reservado'],
    [{ status: 'VENDIDO' }, 'Regla: sin stock'],
    [{ cantidad: 0 }, 'Regla: sin stock'],
    [{ batteryHealth: '79-85%' }, 'Regla: batería < 80 %'],
    [{ batteryHealth: 'N/A' }, 'Regla: batería < 80 %'],
    [{ needsCompletion: true }, 'No disponible'],
  ])('keeps rules ahead of manual hiding: %j', (patch, reason) => {
    expect(draftCatalogReason({ ...item, ...patch }, settings, true)).toBe(reason);
  });
});
