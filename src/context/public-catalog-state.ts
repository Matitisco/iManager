import { useStableState } from '../lib/stable-state';
import { useCallback, useEffect, useRef } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { CatalogSettings, ManagedCatalog } from '../types/public-catalog';
import { changeCatalogVisibility, fetchCatalogSettings, regenerateCatalog, saveCatalogSettings } from '../services/public-catalog-api';

export function usePublicCatalogState(user: AuthUserLike | null, session: AppSession | null, backendStatus: BackendConnectionStatus, updateInventory: (catalog: ManagedCatalog | null) => void) {
  const [publicCatalog, setCatalog] = useStableState<ManagedCatalog | null>(null);
  const ready = backendStatus === 'ready' && !!session?.store && !session.onboardingRequired;
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}`;
  const current = useRef(scope); current.current = scope;
  useEffect(() => { setCatalog(null); }, [scope]);
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
    if (current.current === expected) { setCatalog(data); updateInventory(data); }
  };
  return { publicCatalog, loadPublicCatalog, savePublicCatalog, regeneratePublicCatalog, setCatalogVisibility };
}
