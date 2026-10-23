import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUserLike } from "../types/auth-user";
import {
  getGettingStarted,
  updateGettingStarted,
  type GettingStartedProgress,
  type ProgressPatch,
} from "../services/getting-started-api";

export function useGettingStartedState(
  user: AuthUserLike | null,
  storeId?: string,
) {
  const [progress, setProgress] = useState<GettingStartedProgress | null>(null);
  const scope = `${user?.uid ?? ""}:${storeId ?? ""}`;
  const [settledScope, setSettledScope] = useState<string | null>(null);
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
  }, [user, storeId, scope]);
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
    [user, storeId, scope],
  );
  useEffect(() => {
    setProgress(null);
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return {
    gettingStarted: progressScope.current === scope ? progress : null,
    gettingStartedLoaded: settledScope === scope,
    refreshGettingStarted: refresh,
    updateGettingStarted: update,
  };
}
