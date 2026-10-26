import { useStableState } from '../lib/stable-state';
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeReconnect } from '../lib/online';
import type { AuthUserLike } from "../types/auth-user";
import {
  getGettingStarted,
  updateGettingStarted,
  type GettingStartedProgress,
  type ProgressPatch,
} from "../services/getting-started-api";

type StockExit = { via: NonNullable<ProgressPatch['completedVia']>; pending: boolean };
const exitKey = (scope: string) => `imanager:stock-exit:${scope}`;
function readExit(scope: string): StockExit | null {
  try {
    const value = JSON.parse(localStorage.getItem(exitKey(scope)) ?? 'null');
    return value && ['import', 'skip', 'sample'].includes(value.via) && typeof value.pending === 'boolean' ? value : null;
  } catch { return null; }
}
function writeExit(scope: string, value: StockExit) {
  try { localStorage.setItem(exitKey(scope), JSON.stringify(value)); }
  catch { /* Memory still permits leaving when storage is unavailable. */ }
}

export function useGettingStartedState(
  user: AuthUserLike | null,
  storeId?: string,
) {
  const [progress, setProgress] = useStableState<GettingStartedProgress | null>(null);
  const scope = `${user?.uid ?? ""}:${storeId ?? ""}`;
  const [exitedScope, setExitedScope] = useState<string | null>(null);
  const syncing = useRef(new Set<string>());
  const [settledScope, setSettledScope] = useStableState<string | null>(null);
  const current = useRef(scope);
  const requestVersion = useRef(0);
  const progressScope = useRef("");
  current.current = scope;
  const refresh = useCallback(async () => {
    if (!user || !storeId) return;
    const version = ++requestVersion.current;
    try {
      const next = await getGettingStarted(user);
      if (current.current === scope && requestVersion.current === version) {
        progressScope.current = scope;
        setProgress(next);
        setSettledScope(scope);
      }
    } catch (cause) {
      if (current.current === scope && requestVersion.current === version) {
        setSettledScope(scope);
        console.warn("No se pudieron cargar tus primeros pasos.", cause);
      }
    }
  }, [user?.uid, storeId, scope]);
  const update = useCallback(
    async (patch: ProgressPatch) => {
      if (!user || !storeId) throw new Error("No hay una tienda activa.");
      const version = ++requestVersion.current;
      const next = await updateGettingStarted(user, patch);
      if (current.current === scope && requestVersion.current === version) {
        progressScope.current = scope;
        setProgress(next);
        setSettledScope(scope);
      }
    },
    [user?.uid, storeId, scope],
  );
  const syncStockExit = useCallback(async (via?: StockExit['via']) => {
    const saved = readExit(scope);
    if (!user || !storeId || syncing.current.has(scope) || (!via && !saved?.pending)) return;
    syncing.current.add(scope);
    try {
      const completedVia = via ?? saved!.via;
      await update({ complete: true, completedVia });
      writeExit(scope, { via: completedVia, pending: false });
    } catch {
      console.warn('El progreso de stock queda pendiente de sincronización.');
    } finally {
      syncing.current.delete(scope);
    }
  }, [scope, user?.uid, storeId, update]);
  const finishStockOnboarding = useCallback((via: StockExit['via']) => {
    if (!user || !storeId) throw new Error('No hay una tienda activa.');
    // This records a navigation choice, never a successful inventory write.
    writeExit(scope, { via, pending: true });
    setExitedScope(scope);
    void syncStockExit(via);
  }, [scope, user?.uid, storeId, syncStockExit]);
  useEffect(() => {
    const retry = () => { void syncStockExit(); };
    retry();
    window.addEventListener('focus', retry);
    const unsubscribe = subscribeReconnect(retry);
    return () => { window.removeEventListener('focus', retry); unsubscribe(); };
  }, [syncStockExit]);
  useEffect(() => {
    setProgress(null);
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return {
    gettingStarted: progressScope.current === scope ? progress : null,
    gettingStartedLoaded: settledScope === scope,
    stockOnboardingExited: !!user && !!storeId && (exitedScope === scope || readExit(scope) !== null),
    finishStockOnboarding,
    refreshGettingStarted: refresh,
    updateGettingStarted: update,
  };
}
