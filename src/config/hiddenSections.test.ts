import { describe, expect, it } from 'vitest';
import { HIDDEN_SECTIONS, hiddenPathFallback, isPathHidden, isSectionHidden } from './hiddenSections';

describe('temporary section visibility', () => {
  it('keeps the central switch readonly and recognizes internal ids', () => {
    expect(Object.isFrozen(HIDDEN_SECTIONS)).toBe(true);
    for (const id of ['caja', 'cajas', 'cash', 'cuenta-corriente', 'cuenta', 'seguimientos', 'followups']) {
      expect(isSectionHidden(id)).toBe(true);
    }
    expect(isSectionHidden('clients')).toBe(false);
    expect(isSectionHidden('inventory')).toBe(false);
  });

  it.each([
    ['#cash', '#/dashboard'],
    ['/finanzas/cajas/123?tab=movimientos', '#/dashboard'],
    ['#/atencion/seguimientos', '#/atencion/clientes'],
    ['#/clientes/cuenta', '#/atencion/clientes'],
    ['#/atencion/clientes?view=cuenta', '#/atencion/clientes'],
    ['#/clients?tab=seguimientos', '#/atencion/clientes'],
    ['#/cuenta-corriente', '#/atencion/clientes'],
  ])('redirects %s to %s', (path, fallback) => {
    expect(isPathHidden(path)).toBe(true);
    expect(hiddenPathFallback(path)).toBe(fallback);
  });

  it.each(['#/finanzas/gastos', '#/expenses', '#/gastos?from=clients', '#/cuenta/configuracion/equipo/cash', '#/cuenta/notificaciones', '#/atencion/clientes', '#/comercial/ventas', '#/stock/equipos', '#/analisis/reportes', '#/finanzas/proveedores', '#/gastos-extra'])('preserves %s', path => {
    expect(isPathHidden(path)).toBe(false);
    expect(hiddenPathFallback(path)).toBeNull();
  });
});
