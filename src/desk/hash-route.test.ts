import { describe, expect, it } from 'vitest';
import { canonicalHash, configHash, configPlace, tabFromHash, writeHash } from './hash-route';

describe('ruta del escritorio', () => {
  it.each([
    ['#/returns?view=patterns', '#/analisis/patrones', 'patterns'],
    ['#/comercial/devoluciones?view=patterns&groupBy=purchase&group=compra+1', '#/analisis/patrones?groupBy=purchase&group=compra+1', 'patterns'],
    ['#/returns?view=claims', '#/comercial/devoluciones', 'returns'],
    ['#/comercial/devoluciones?view=claims', '#/comercial/devoluciones', 'returns'],
    ['#/analisis/reportes/resumen-periodico', '#/analisis/resumen-periodico', 'periodicSummary'],
    ['#/periodicSummary?period=latest-month', '#/analisis/resumen-periodico?period=latest-month', 'periodicSummary'],
    ['#/rep?view=periodic&period=latest-month', '#/analisis/resumen-periodico?period=latest-month', 'periodicSummary'],
    ['#/stock/catalogo?view=items', '#/stock/catalogo', 'publicCatalog'],
    ['#/stock/catalogo?view=summary', '#/stock/catalogo', 'publicCatalog'],
  ])('migrates %s without an extra navigation level', (old, expected, tab) => {
    expect(canonicalHash(old)).toBe(expected);
    expect(canonicalHash(expected)).toBe(expected);
    expect(tabFromHash(old)).toBe(tab);
    expect(tabFromHash(expected)).toBe(tab);
  });

  it('distingue el resumen periódico de Reportes al recuperar la URL', () => {
    expect(canonicalHash('#/analisis/resumen-periodico')).toBe('#/analisis/resumen-periodico');
    expect(tabFromHash('#/analisis/resumen-periodico')).toBe('periodicSummary');
    expect(tabFromHash('#/analisis/reportes')).toBe('reports');
  });
  it('abre Plan y facturación aunque Mercado Pago agregue query al hash', () => {
    expect(tabFromHash('#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1')).toBe('billing');
    expect(tabFromHash('#/plan')).toBe('billing');
    expect(tabFromHash('#plan?preapproval_id=pre-1')).toBe('billing');
  });
  it('un hash desconocido sigue yendo al inicio', () => {
    expect(tabFromHash('#/no-existe?preapproval_id=pre-1')).toBe('dashboard');
    expect(tabFromHash('')).toBe('dashboard');
  });

  it('keeps Equipo and Permisos inside Configuración', () => {
    expect(tabFromHash('#/config/equipo')).toBe('settings');
    expect(tabFromHash('#/config/equipo/m2')).toBe('settings');
    expect(configPlace('#/config')).toEqual({ page: 'settings', memberId: null });
    expect(configPlace('#/config/equipo')).toEqual({ page: 'team', memberId: null });
    expect(configPlace('#/config/equipo/m2')).toEqual({ page: 'team', memberId: 'm2' });
  });

  it('redirige las rutas viejas y deja quieto lo que no es del escritorio', () => {
    expect(canonicalHash('#/ven')).toBe('#/comercial/ventas');
    expect(canonicalHash('#/canjes')).toBe('#/comercial/canjes');
    expect(canonicalHash('#/inv')).toBe('#/stock/equipos');
    expect(canonicalHash('#/proveedores')).toBe('#/finanzas/proveedores');
    expect(canonicalHash('#/stock/proveedores?from=stock')).toBe('#/finanzas/proveedores?from=stock');
    expect(canonicalHash('#/finanzas/proveedores')).toBe('#/finanzas/proveedores');
    expect(tabFromHash('#/stock/proveedores')).toBe('suppliers');
    expect(tabFromHash('#/finanzas/proveedores')).toBe('suppliers');
    expect(canonicalHash('#/catalogo')).toBe('#/stock/catalogo');
    expect(canonicalHash('#/servicio')).toBe('#/atencion/servicio');
    expect(canonicalHash('#/cajas')).toBe('#/dashboard');
    expect(canonicalHash('#/gastos')).toBe('#/dashboard');
    expect(canonicalHash('#/rep')).toBe('#/analisis/reportes');
    expect(canonicalHash('#/comisiones')).toBe('#/analisis/comisiones');
    expect(canonicalHash('#/historial')).toBe('#/analisis/historial');
    expect(canonicalHash('#/notif')).toBe('#/cuenta/notificaciones');
    expect(canonicalHash('#/config/equipo/m2?tab=permisos')).toBe('#/cuenta/configuracion/equipo/m2?tab=permisos');
    expect(canonicalHash('')).toBe('#/dashboard');
    expect(canonicalHash('#/comercial/ventas')).toBe('#/comercial/ventas');
    expect(canonicalHash('#/restablecer?mode=resetPassword')).toBeNull();
    expect(canonicalHash('#/salida')).toBeNull();
    expect(canonicalHash('#/no-existe')).toBeNull();
    expect(tabFromHash('#/tradeins')).toBe('tradeins');
    expect(tabFromHash('#/returns')).toBe('returns');
    expect(tabFromHash('#/suppliers')).toBe('suppliers');
    expect(tabFromHash('#/expenses')).toBe('dashboard');
    expect(tabFromHash('#/history')).toBe('history');
    expect(tabFromHash('#/commissions')).toBe('commissions');
    expect(tabFromHash('#/publicCatalog')).toBe('publicCatalog');
    expect(tabFromHash('#/cash')).toBe('dashboard');
    expect(tabFromHash('#/service')).toBe('service');
    expect(tabFromHash('#/stockCount')).toBe('stockCount');
    expect(tabFromHash('#/followups')).toBe('clients');
    expect(configHash('team', 'm2')).toBe('#/cuenta/configuracion/equipo/m2');
    expect(configPlace('#/cuenta/configuracion/equipo/m2')).toEqual({ page: 'team', memberId: 'm2' });
  });

  it('pushes one history entry per level so browser back climbs a single step', () => {
    writeHash('#/dash');
    writeHash('#/config');
    writeHash('#/config/equipo');
    const beforeMember = history.length;
    writeHash('#/config/equipo/m2');
    expect(history.length).toBe(beforeMember + 1);
    expect(configPlace(window.location.hash)).toEqual({ page: 'team', memberId: 'm2' });
    expect(tabFromHash(window.location.hash)).toBe('settings');
    writeHash('#/config/equipo', 'replace');
    expect(history.length).toBe(beforeMember + 1);
    expect(configPlace(window.location.hash)).toEqual({ page: 'team', memberId: null });
  });
});
