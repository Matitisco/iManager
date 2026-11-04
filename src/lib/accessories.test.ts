import { describe, expect, it } from 'vitest';
import { ACCESSORY_TYPES, LOW_STOCK_THRESHOLD, accessoryError, isAccessory, isDevice, isLowStock } from './accessories';

describe('accesorios por cantidad', () => {
  it('conserva los equipos anteriores y el umbral compartido', () => {
    expect(isDevice({})).toBe(true);
    expect(isAccessory({ kind: 'ACCESSORY' })).toBe(true);
    expect(LOW_STOCK_THRESHOLD).toBe(5);
    expect([0, 2, 4, 5, 6].map(isLowStock)).toEqual([true, true, true, false, false]);
  });
  it.each(ACCESSORY_TYPES)('acepta %s sin campos de celular, incluso stock cero', accessoryType => {
    expect(accessoryError({ accessoryType, cantidad: 0, imei: '', batteryHealth: '', condition: '' })).toBeNull();
  });
  it.each([-1, 0.5, NaN, Infinity, 2147483648])('rechaza cantidad inválida %s', cantidad => {
    expect(accessoryError({ accessoryType: 'Cable', cantidad })).toContain('cantidad entera');
  });
  it('rechaza IMEI, batería, condición y tipos fuera de la lista', () => {
    expect(accessoryError({ accessoryType: 'Inventado', cantidad: 1 })).toContain('tipo');
    expect(accessoryError({ accessoryType: 'Cable', cantidad: 1, imei: '490154203237518' })).toContain('IMEI');
    for (const field of ['batteryHealth', 'condition', 'grade', 'capacity', 'color']) {
      expect(accessoryError({ accessoryType: 'Cable', cantidad: 1, [field]: 'dato' })).toContain('no llevan');
    }
  });
});
