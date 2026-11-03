import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '../types/app-session';
import type { NamedCatalog } from '../types/public-catalog';
import * as api from '../services/public-catalog-api';
import { usePublicCatalogState } from './public-catalog-state';
vi.mock('../services/public-catalog-api', () => ({ fetchStoreCatalogs: vi.fn(), saveStoreCatalog: vi.fn(), deleteStoreCatalog: vi.fn(), regenerateStoreCatalog: vi.fn(), previewStoreCatalog: vi.fn(), fetchCatalogSettings: vi.fn(), saveCatalogSettings: vi.fn(), regenerateCatalog: vi.fn(), changeCatalogVisibility: vi.fn() }));
const user = { uid: 'fake-owner', email: null, displayName: null, getIdToken: vi.fn(async () => 'fake-token') };
function session(id = 'fake-store'): AppSession {
  return { user: { id: 'fake-user', firebaseUid: user.uid, email: null, displayName: null, avatarUrl: null }, store: { id, name: 'Tienda falsa', legalName: null, taxId: null, phone: null, email: null, instagram: null, address: null, currency: 'USD', timezone: 'America/Argentina/Buenos_Aires' }, membership: { role: 'OWNER', isDefault: true }, onboardingRequired: false };
}
function catalog(name = 'Clientes finales'): NamedCatalog {
  return { id: 'fake-catalog', name, isDefault: true, slug: 'fake-link', active: true, hideWithoutStock: true, hideReserved: true, minBattery: null, showPrice: true, priceCurrency: 'ORIGINAL', logoUrl: null, hours: null, priceRuleMode: 'LIST_PERCENT', priceAdjustPercent: 0, items: [], counts: { visible: 0, rules: 0, manual: 0, available: 0 } };
}
beforeEach(() => vi.resetAllMocks());
describe('catalog session and completed writes', () => {
  it('uses the canonical save response without a second read that could report failure after creation', async () => {
    const saved = { ...catalog('Mayoristas'), id: 'new-catalog', isDefault: false };
    vi.mocked(api.saveStoreCatalog).mockResolvedValue(saved);
    const { result } = renderHook(() => usePublicCatalogState(user, session(), 'ready', vi.fn()));
    await act(async () => { await result.current.saveNamedCatalog(null, { name: 'Mayoristas' }); });
    expect(result.current.storeCatalogs).toEqual([saved]);
    expect(api.fetchStoreCatalogs).not.toHaveBeenCalled();
  });
  it('discards a pending list response when a more recent mutation has completed', async () => {
    let finish!: (rows: NamedCatalog[]) => void;
    vi.mocked(api.fetchStoreCatalogs).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(api.saveStoreCatalog).mockResolvedValue(catalog('Nombre guardado'));
    const { result } = renderHook(() => usePublicCatalogState(user, session(), 'ready', vi.fn()));
    let loading!: Promise<NamedCatalog[]>;
    act(() => { loading = result.current.loadStoreCatalogs(); });
    await act(async () => { await result.current.saveNamedCatalog('fake-catalog', { name: 'Nombre guardado' }); });
    await act(async () => { finish([catalog('Nombre anterior')]); await loading; });
    expect(result.current.storeCatalogs[0].name).toBe('Nombre guardado');
    expect(result.current.publicCatalog).toMatchObject({ name: 'Nombre guardado' });
  });
  it('ignores a save response after the active store changes', async () => {
    let finish!: (row: NamedCatalog) => void;
    vi.mocked(api.saveStoreCatalog).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const updateInventory = vi.fn();
    const { result, rerender } = renderHook(({ storeId }) => usePublicCatalogState(user, session(storeId), 'ready', updateInventory), { initialProps: { storeId: 'store-a' } });
    let saving!: Promise<NamedCatalog>;
    act(() => { saving = result.current.saveNamedCatalog('fake-catalog', { name: 'Tienda A' }); });
    rerender({ storeId: 'store-b' });
    await act(async () => { finish(catalog('Tienda A')); await saving; });
    expect(result.current.storeCatalogs).toEqual([]);
    expect(result.current.publicCatalog).toBeNull();
    expect(updateInventory).not.toHaveBeenCalled();
  });
});
