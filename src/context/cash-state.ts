import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { CashCommand, CashData, CashFilters } from '../types/cash';
import { cashCommand, fetchCash, fetchCashHistory, fetchCashSessions } from '../services/cash-api';

export function useCashState(user: AuthUserLike | null, session: AppSession | null, status: BackendConnectionStatus) {
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}:${JSON.stringify(session?.membership?.sections)}`;
  const current = useRef(scope); current.current = scope;
  const generation = useRef(0);
  const [state, setState] = useState<{ scope: string; data: CashData | null }>({ scope, data: null });
  const ready = !!user && status === 'ready' && !!session?.store && !session.onboardingRequired;
  useEffect(() => { generation.current += 1; setState({ scope, data: null }); }, [scope, ready]);
  const auth = useCallback(() => {
    if (!user || !ready) throw new Error('El backend todavía no está listo. Volvé a intentar.');
    if (current.current !== scope) throw new Error('La tienda cambió. Volvé a abrir Cajas.');
    return user;
  }, [user, ready, scope]);
  const loadCash = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const data = await fetchCash(auth());
      if (scope === current.current && ticket === generation.current) setState({ scope, data });
      return data;
    } catch (error) {
      if (scope === current.current && ticket === generation.current) setState({ scope, data: null });
      throw error;
    }
  }, [scope, auth]);
  const mutateCash = async (command: CashCommand) => {
    const result = await cashCommand(auth(), command);
    if (current.current !== scope) throw new Error('La tienda cambió. El movimiento quedó registrado en la tienda anterior.');
    // Mutation succeeded. Refresh errors must not cause the caller to resubmit money.
    generation.current += 1;
    setState({ scope, data: null });
    return result;
  };
  const loadCashHistory = useCallback((id: string, filters: CashFilters) => fetchCashHistory(auth(), id, filters), [auth]);
  const loadCashSessions = useCallback((id: string) => fetchCashSessions(auth(), id), [auth]);
  return { cashData: ready && state.scope === scope ? state.data : null, loadCash, mutateCash, loadCashHistory, loadCashSessions };
}
