import { describe, expect, it } from 'vitest';
import {
  MOBILE_PAGE_SIZE,
  buildStoreActivity,
  canOpenScreen,
  formatMoney,
  formatMoneyCompact,
  hasMorePages,
  isInPeriod,
  mapImportRows,
  navTabForScreen,
  parseEsDate,
  parseMoneyInput,
  reportQuery,
  tabsForRole,
} from './logic';

describe('mobile layout helpers', () => {
  it('keeps reportes off the staff tab bar', () => {
    expect(tabsForRole('STAFF').map((tab) => tab.id)).not.toContain('rep');
    expect(tabsForRole('OWNER')).toHaveLength(5);
    expect(canOpenScreen('STAFF', 'rep')).toBe(false);
    expect(canOpenScreen('STAFF', 'canjes')).toBe(true);
    expect(navTabForScreen('clientes')).toBe('mas');
    expect(navTabForScreen('notif')).toBeNull();
  });

  it('formats money with the prototype separators', () => {
    expect(formatMoney(650000)).toBe('$ 650.000');
    expect(formatMoneyCompact(1_250_000)).toBe('$ 1,25M');
    expect(parseMoneyInput('$ 1.100.000')).toBe(1100000);
    expect(MOBILE_PAGE_SIZE).toBe(16);
    expect(hasMorePages(16, 20)).toBe(true);
    expect(hasMorePages(20, 20)).toBe(false);
  });

  it('parses store dates and period ranges', () => {
    expect(parseEsDate('06 oct 2026')?.getMonth()).toBe(9);
    expect(isInPeriod('06 oct 2026', 'Mes', new Date(2026, 9, 6))).toBe(true);
    expect(isInPeriod('01 ene 2024', 'Mes', new Date(2026, 9, 6))).toBe(false);
    expect(reportQuery('Mes').rangeKey).toBe('this_month');
    expect(reportQuery('Semana', new Date(2026, 9, 6)).startDate).toBe('2026-09-30');
  });

  it('builds notifications from real records and maps import headers', () => {
    const activity = buildStoreActivity({
      sales: [{ id: 's1', date: '06 oct 2026', clientId: 'c', productId: 'p', amount: 10, paymentMethod: 'EFECTIVO', status: 'PENDIENTE' }],
      tradeIns: [],
      inventory: [{ id: 'e1', imei: '1', model: 'iPhone 13', capacity: '128GB', color: 'Azul', condition: 'USADO', grade: 'A', batteryHealth: '90', cost: 1, price: 2, status: 'EN_REVISION' }],
      clients: [],
    });
    expect(activity.map((item) => item.title)).toEqual(['Venta pendiente', 'Equipo en revisión']);

    const mapped = mapImportRows(
      [
        ['Modelo', 'IMEI', 'Precio'],
        ['iPhone 13', '350000000000010', '650000'],
      ],
      [
        { key: 'model', label: 'Modelo', required: true },
        { key: 'imei', label: 'IMEI' },
        { key: 'price', label: 'Precio' },
      ],
      { modelo: 'model', precio: 'price' },
    );
    expect(mapped.missingRequired).toEqual([]);
    expect(mapped.rows[0]).toMatchObject({ model: 'iPhone 13', price: '650000' });
  });
});
