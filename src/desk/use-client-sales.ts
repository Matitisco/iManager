import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { toUserMessage } from '../lib/user-message';
import { fetchClientSales } from '../services/clients-api';
import type { Sale } from '../types';

/** Revalidate on open and local mutations; never treat a cached subset as complete. */
export function useClientSales(clientId: string, sales: Sale[]) {
  const { user, appSession, backendStatus } = useAppContext();
  const enabled = Boolean(user && appSession?.store && !appSession.onboardingRequired && (!backendStatus || backendStatus === 'ready'));
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}:${clientId}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ scope: string; rows: Sale[]; loading: boolean; error: string | null }>({ scope, rows: [], loading: enabled, error: null });
  useEffect(() => {
    if (!enabled || !user) return;
    let current = true;
    setResult({ scope, rows: [], loading: true, error: null });
    void fetchClientSales(user, clientId).then(rows => {
      if (current) setResult({ scope, rows, loading: false, error: null });
    }).catch((cause: unknown) => {
      if (current) setResult({ scope, rows: [], loading: false, error: toUserMessage(cause, 'No se pudieron cargar las compras') });
    });
    return () => { current = false; };
  }, [user, enabled, scope, clientId, sales, attempt]);
  const state = !enabled ? { rows: sales, loading: false, error: null }
    : result.scope === scope ? result : { rows: [], loading: true, error: null };
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
