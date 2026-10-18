import { describe, expect, it } from 'vitest';
import { isStoreActivityPath, isTestStore, sortStoreActivity, stageLabel, type StoreActivityRow } from './store-activity';

function row(patch: Partial<StoreActivityRow> & Pick<StoreActivityRow, 'id' | 'name' | 'createdAt'>): StoreActivityRow {
  return {
    ownerEmail: null,
    billingPlan: 'TRIAL',
    billingStatus: 'TRIAL',
    trialEndsAt: null,
    onboardingStage: null,
    counts: { storeMembers: 1, inventoryItems: 0, sales: 0, clients: 0, repairOrders: 0 },
    lastActivityAt: null,
    ...patch,
  };
}

describe('store activity helpers', () => {
  it('recognizes only the activity path', () => {
    expect(isStoreActivityPath('/admin/actividad')).toBe(true);
    expect(isStoreActivityPath('/admin/actividad/')).toBe(true);
    expect(isStoreActivityPath('/admin/actividad/embudo')).toBe(true);
    expect(isStoreActivityPath('/admin/actividad/tienda/club')).toBe(true);
    expect(isStoreActivityPath('/admin/actividad/tienda/club/extra')).toBe(false);
    expect(isStoreActivityPath('/admin/actividad/extra')).toBe(false);
    expect(isStoreActivityPath('/')).toBe(false);
  });

  it('uses the current onboarding stages without legacy team/video labels', () => {
    expect(stageLabel('name')).toBe('Nombre');
    expect(stageLabel('invite')).toBe('Nombre');
    expect(stageLabel('stock')).toBe('Stock');
    expect(stageLabel('video')).toBe('Completo');
    expect(stageLabel('complete')).toBe('Completo');
  });

  it('hides example.com owners and names that look like test data', () => {
    expect(isTestStore(row({ id: '1', name: 'iphoneclub', createdAt: '2026-10-01T00:00:00.000Z', ownerEmail: 'ma***@tienda.com' }))).toBe(false);
    expect(isTestStore(row({ id: '2', name: '1St', createdAt: '2026-10-01T00:00:00.000Z', ownerEmail: 'cl***@tienda.com' }))).toBe(false);
    expect(isTestStore(row({ id: '3', name: 'QA-caja', createdAt: '2026-10-01T00:00:00.000Z' }))).toBe(true);
    expect(isTestStore(row({ id: '4', name: 'Demo centro', createdAt: '2026-10-01T00:00:00.000Z' }))).toBe(true);
    expect(isTestStore(row({ id: '5', name: 'smoke-run', createdAt: '2026-10-01T00:00:00.000Z' }))).toBe(true);
    expect(isTestStore(row({ id: '6', name: 'Local', createdAt: '2026-10-01T00:00:00.000Z', ownerEmail: 'qa***@example.com' }))).toBe(true);
    expect(isTestStore(row({ id: '7', name: 'Local', createdAt: '2026-10-01T00:00:00.000Z', ownerEmail: 'qa***@example.com.ar' }))).toBe(false);
  });

  it('sorts by creation or last activity, newest first, with empty activity last', () => {
    const stores = [
      row({ id: 'old', name: '1St', createdAt: '2026-09-01T15:00:00.000Z', lastActivityAt: '2026-10-17T18:00:00.000Z' }),
      row({ id: 'new', name: 'iphoneclub', createdAt: '2026-10-10T15:00:00.000Z', lastActivityAt: '2026-10-16T18:00:00.000Z' }),
      row({ id: 'quiet', name: 'Nueva', createdAt: '2026-10-12T15:00:00.000Z', lastActivityAt: null }),
    ];
    expect(sortStoreActivity(stores, 'createdAt').map((store) => store.id)).toEqual(['quiet', 'new', 'old']);
    expect(sortStoreActivity(stores, 'lastActivityAt').map((store) => store.id)).toEqual(['old', 'new', 'quiet']);
  });
});
