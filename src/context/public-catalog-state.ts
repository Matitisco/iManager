import { useStableState } from '../lib/stable-state';
import { useCallback, useEffect, useRef } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { CatalogEdit, NamedCatalog, CatalogSettings, ManagedCatalog } from '../types/public-catalog';
import { changeStoreCatalogVisibility, regenerateStoreCatalog, deleteStoreCatalog, fetchStoreCatalogs, previewStoreCatalog, saveStoreCatalog, changeCatalogVisibility, fetchCatalogSettings, regenerateCatalog, saveCatalogSettings } from '../services/public-catalog-api';

export function usePublicCatalogState(user: AuthUserLike | null, session: AppSession | null, backendStatus: BackendConnectionStatus, updateInventory: () => void) {
  const [publicCatalog, setCatalog] = useStableState<ManagedCatalog | null>(null);
  const [storeCatalogs, setStoreCatalogs] = useStableState<NamedCatalog[]>([]);
  const ready = backendStatus === 'ready' && !!session?.store && !session.onboardingRequired;
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}:${JSON.stringify(session?.membership?.sections)}`;
  const current = useRef(scope); current.current = scope;
  const listVersion = useRef(0);
  useEffect(() => { setCatalog(null); setStoreCatalogs([]); }, [scope]);
  const auth = () => {
    if (!user || !ready) throw new Error('El backend todavía no está listo. Volvé a intentar.');
    return user;
  };
  const loadPublicCatalog = useCallback(async () => {
    const expected = scope;
    const data = await fetchCatalogSettings(auth());
    if (current.current === expected) { setCatalog(data); updateInventory(); }
    return data;
  }, [user?.uid, ready, scope]);
  const loadStoreCatalogs = useCallback(async () => {
    const expected = scope;
    const version = ++listVersion.current;
    const data = await fetchStoreCatalogs(auth());
    if (current.current === expected && listVersion.current === version) { setStoreCatalogs(data); const defaultCatalog = data.find(row => row.isDefault) ?? null; setCatalog(defaultCatalog); updateInventory(); }
    return data;
  }, [user?.uid, ready, scope]);
  const acceptSavedCatalog = (expected: string, saved: NamedCatalog) => {
    if (current.current !== expected) return;
    ++listVersion.current; // An older list response must not undo a completed write.
    setStoreCatalogs(rows => rows.some(row => row.id === saved.id) ? rows.map(row => row.id === saved.id ? saved : row) : [...rows, saved]);
    if (saved.isDefault) setCatalog(saved);
    updateInventory();
  };
  const saveNamedCatalog = async (id: string | null, input: CatalogEdit) => {
    const expected = scope;
    const saved = await saveStoreCatalog(auth(), id, input);
    acceptSavedCatalog(expected, saved);
    return saved;
  };
  const regenerateNamedCatalog = async (id: string) => {
    const expected = scope;
    const saved = await regenerateStoreCatalog(auth(), id);
    acceptSavedCatalog(expected, saved);
  };
  const deleteNamedCatalog = async (id: string) => {
    const expected = scope;
    await deleteStoreCatalog(auth(), id);
    if (current.current === expected) { ++listVersion.current; setStoreCatalogs(rows => rows.filter(row => row.id !== id)); updateInventory(); }
  };
  const previewNamedCatalog = (id: string | null, input: CatalogEdit, signal?: AbortSignal) => previewStoreCatalog(auth(), id, input, signal);
  const savePublicCatalog = async (input: Partial<CatalogSettings>) => {
    const expected = scope; const data = await saveCatalogSettings(auth(), input);
    if (current.current === expected) { setCatalog(data); updateInventory(); }
  };
  const regeneratePublicCatalog = async () => {
    const expected = scope; const data = await regenerateCatalog(auth());
    if (current.current === expected) { setCatalog(data); updateInventory(); }
  };
  const setCatalogVisibility = async (ids: string[], visible: boolean) => {
    const expected = scope; const data = await changeCatalogVisibility(auth(), ids, visible);
    if (current.current === expected) { setCatalog(data); updateInventory(); if (storeCatalogs.length) await loadStoreCatalogs(); }
  };
  const setNamedCatalogVisibility = async (id: string, ids: string[], visible: boolean) => {
    const expected = scope;
    const saved = await changeStoreCatalogVisibility(auth(), id, ids, visible);
    acceptSavedCatalog(expected, saved);
    // GLOBAL writes also affect other legacy catalogs. Revalidate their counts.
    if (saved.itemVisibility !== 'OWN' && current.current === expected) await loadStoreCatalogs();
  };
  return { setNamedCatalogVisibility, regenerateNamedCatalog, storeCatalogs, loadStoreCatalogs, saveNamedCatalog, deleteNamedCatalog, previewNamedCatalog, publicCatalog, loadPublicCatalog, savePublicCatalog, regeneratePublicCatalog, setCatalogVisibility };
}
