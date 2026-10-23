import { beforeEach, expect, it } from 'vitest';
import { clearDashboardCache, dashboardCacheVersion, readDashboardCache, readLatestDashboardCache, writeDashboardCache, type DashboardCacheEntry } from './dashboard-cache';

beforeEach(clearDashboardCache);

function entry(scope: string): DashboardCacheEntry {
  return { scope, range: null, report: null, members: [], initialResolved: true };
}

it('limita a ocho rangos y descarta el más antiguo sin cruzar alcances', () => {
  const ticket = dashboardCacheVersion();
  writeDashboardCache('old:undefined:undefined', entry('old'), ticket);
  for (let index = 0; index < 8; index++) writeDashboardCache(`current:range-${index}`, entry('current'), ticket);
  expect(readDashboardCache('old:undefined:undefined')).toBeUndefined();
  expect(readLatestDashboardCache('old')).toBeUndefined();
  expect(readDashboardCache('current:range-0')).toEqual(entry('current'));
  expect(readLatestDashboardCache('current')).toEqual(entry('current'));
  expect(readLatestDashboardCache('other')).toBeUndefined();
});

it('consulta la clave exacta sin sustituirla por el último rango del alcance', () => {
  const ticket = dashboardCacheVersion();
  const month = { ...entry('scope'), range: { start: '2026-10-01', end: '2026-10-22' } };
  const total = entry('scope');
  writeDashboardCache('scope:2026-10-01:2026-10-22', month, ticket);
  writeDashboardCache('scope:undefined:undefined', total, ticket);
  expect(readDashboardCache('scope:2026-10-01:2026-10-22')).toEqual(month);
  expect(readLatestDashboardCache('scope')).toEqual(total);
  expect(readDashboardCache('scope:2026-10-01:2026-10-23')).toBeUndefined();
});

it('limpiar la sesión invalida también escrituras de montajes anteriores', () => {
  const ticket = dashboardCacheVersion();
  writeDashboardCache('scope:undefined:undefined', entry('scope'), ticket);
  clearDashboardCache();
  writeDashboardCache('scope:undefined:undefined', entry('scope'), ticket);
  expect(readDashboardCache('scope:undefined:undefined')).toBeUndefined();
  expect(readLatestDashboardCache('scope')).toBeUndefined();
  writeDashboardCache('scope:undefined:undefined', entry('scope'), dashboardCacheVersion());
  expect(readDashboardCache('scope:undefined:undefined')?.range).toBeNull();
});
