import { useStableState } from '../lib/stable-state';
import { useCallback, useEffect, useRef } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { CatalogEdit, NamedCatalog, CatalogSettings, ManagedCatalog } from '../types/public-catalog';
import { regenerateStoreCatalog, deleteStoreCatalog, fetchStoreCatalogs, previewStoreCatalog, saveStoreCatalog, changeCatalogVisibility, fetchCatalogSettings, regenerateCatalog, saveCatalogSettings } from '../services/public-catalog-api';

export function usePublicCatalogState(user: AuthUserLike | null, session: AppSession | null, backendStatus: BackendConnectionStatus, updateInventory: (catalog: ManagedCatalog | null) => void) {
  const [publicCatalog, setCatalog] = useStableState<ManagedCatalog | null>(null);
  const [storeCatalogs, setStoreCatalogs] = useStableState<NamedCatalog[]>([]);
  const ready = backendStatus === 'ready' && !!session?.store && !session.onboardingRequired;
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}:${JSON.stringify(session?.membership?.sections)}`;
  const current = useRef(scope); current.current = scope;
  useEffect(() => { setCatalog(null); setStoreCatalogs([]); }, [scope]);
  const auth = () => {
    if (!user || !ready) throw new Error('El backend todavía no está listo. Volvé a intentar.');
    return user;
  };
  const loadPublicCatalog = useCallback(async () => {
    const expected = scope;
    const data = await fetchCatalogSettings(auth());
    if (current.current === expected) { setCatalog(data); updateInventory(data); }
    return data;
  }, [user?.uid, ready, scope]);
  const loadStoreCatalogs = useCallback(async () => {
    const expected = scope;
    const data = await fetchStoreCatalogs(auth());
    if (current.current === expected) { setStoreCatalogs(data); const defaultCatalog = data.find(row => row.isDefault) ?? null; setCatalog(defaultCatalog); updateInventory(defaultCatalog); }
    return data;
  }, [user?.uid, ready, scope]);
  const saveNamedCatalog = async (id: string | null, input: CatalogEdit) => {
    const expected = scope;
    const saved = await saveStoreCatalog(auth(), id, input);
    if (current.current === expected) await loadStoreCatalogs();
    return saved;
  };
  const regenerateNamedCatalog = async (id: string) => {
    const expected = scope;
    await regenerateStoreCatalog(auth(), id);
    if (current.current === expected) await loadStoreCatalogs();
  };
  const deleteNamedCatalog = async (id: string) => {
    const expected = scope;
    await deleteStoreCatalog(auth(), id);
    if (current.current === expected) await loadStoreCatalogs();
  };
  const previewNamedCatalog = (id: string | null, input: CatalogEdit, signal?: AbortSignal) => previewStoreCatalog(auth(), id, input, signal);
  const savePublicCatalog = async (input: Partial<CatalogSettings>) => {
    const expected = scope; const data = await saveCatalogSettings(auth(), input);
    if (current.current === expected) { setCatalog(data); updateInventory(data); }
  };
  const regeneratePublicCatalog = async () => {
    const expected = scope; const data = await regenerateCatalog(auth());
    if (current.current === expected) { setCatalog(data); updateInventory(data); }
  };
  const setCatalogVisibility = async (ids: string[], visible: boolean) => {
    const expected = scope; const data = await changeCatalogVisibility(auth(), ids, visible);
    if (current.current === expected) { setCatalog(data); updateInventory(data); if (storeCatalogs.length) await loadStoreCatalogs(); }
  };
  return { regenerateNamedCatalog, storeCatalogs, loadStoreCatalogs, saveNamedCatalog, deleteNamedCatalog, previewNamedCatalog, publicCatalog, loadPublicCatalog, savePublicCatalog, regeneratePublicCatalog, setCatalogVisibility };
}
