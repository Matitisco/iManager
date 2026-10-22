import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AuthUserLike } from '../types/auth-user';

/** Supplemental list data only; active business records and totals stay in AppContext. */
export function useArchivedRows<T>(
  activeRows: readonly T[] | null | undefined,
  load: (user: AuthUserLike) => Promise<T[]>,
  remember?: (rows: T[]) => void,
) {
  const { user, appSession, backendStatus } = useAppContext();
  const enabled = Boolean(user && appSession?.store && !appSession.onboardingRequired && (!backendStatus || backendStatus === 'ready'));
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}`;
  const [result, setResult] = useState<{ scope: string; rows: T[]; loading: boolean }>({ scope, rows: [], loading: enabled });
  useEffect(() => {
    if (!user || !enabled) return;
    let active = true;
    setResult({ scope, rows: [], loading: true });
    void load(user).then(rows => {
      if (!active) return;
      remember?.(rows);
      setResult({ scope, rows, loading: false });
    }).catch((cause: unknown) => {
      if (!active) return;
      console.warn('No se pudieron cargar los registros archivados o anulados.', cause);
      setResult({ scope, rows: [], loading: false });
    });
    return () => { active = false; };
  }, [user, enabled, scope, activeRows, load, remember]);
  return result.scope === scope && enabled ? result : { rows: [] as T[], loading: false };
}
