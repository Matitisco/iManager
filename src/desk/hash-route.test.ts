import { describe, expect, it } from 'vitest';
import { configPlace, tabFromHash, writeHash } from './hash-route';

describe('ruta del escritorio', () => {
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
