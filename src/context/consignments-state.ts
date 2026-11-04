import { useCallback, useEffect, useRef } from 'react';
import { useStableState } from '../lib/stable-state';
import { publishListMutation, useListRefresh } from '../lib/list-sync';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';
import type { Consignment, Sale } from '../types';
import { canOpenSection } from '../desk/sections';
import * as api from '../services/consignments-api';

export function useConsignmentsState(
  user: AuthUserLike | null,
  session: AppSession | null,
  status: BackendConnectionStatus,
  confirmed: boolean,
  onMutation: (items: Consignment[], sale?: Sale) => void,
) {
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}:${JSON.stringify(session?.membership?.sections)}:${status}:${confirmed}`;
  const epoch = useRef({ key: scope, version: 0 });
  if (epoch.current.key !== scope)
    epoch.current = { key: scope, version: epoch.current.version + 1 };
  const generation = epoch.current.version;
  const current = useRef(generation);
  current.current = generation;
  const revision = useRef(0);
  const handler = useRef(onMutation);
  handler.current = onMutation;
  const ready =
    !!user &&
    confirmed &&
    status === 'ready' &&
    !!session?.store &&
    !session.onboardingRequired &&
    canOpenSection(
      'sales',
      session.membership?.sections,
      session.membership?.role,
    );
  const [state, setState] = useStableState<{
    scope: string;
    data: api.ConsignmentList | null;
    error: string;
  }>({ scope, data: null, error: '' });
  const reloadConsignments = useCallback(async () => {
    if (!ready || !user) return;
    const ticket = ++revision.current;
    try {
      const data = await api.fetchConsignments(user);
      if (current.current === generation && ticket === revision.current)
        setState({ scope, data, error: '' });
    } catch (error) {
      if (current.current === generation && ticket === revision.current)
        setState((old) => ({
          scope,
          data: old.scope === scope ? old.data : null,
          error:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las consignaciones',
        }));
    }
  }, [scope, generation, ready, user?.uid]);
  useEffect(() => {
    void reloadConsignments();
  }, [reloadConsignments]);
  useListRefresh(ready, reloadConsignments, session?.store?.id ?? null);
  const auth = () => {
    if (!ready || !user)
      throw new Error(
        'El backend todavía no está listo o no tenés acceso a Consignaciones.',
      );
    return user;
  };
  const remember = (rows: Consignment[], sale?: Sale) => {
    if (current.current !== generation) return;
    revision.current++;
    setState((old) => {
      if (old.scope !== scope || !old.data)
        return { scope, data: null, error: '' };
      const items = [
        ...old.data.items.filter(
          (row) => !rows.some((saved) => saved.id === row.id),
        ),
        ...rows.filter((row) => !row.paidAt),
      ].sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt));
      const debt = { ARS: 0, USD: 0 };
      for (const item of items)
        debt[item.currency] += Math.round(item.amount * 100) * item.cantidad;
      return {
        scope,
        data: {
          items,
          totals: {
            debt: { ARS: debt.ARS / 100, USD: debt.USD / 100 },
            equipment: items.reduce((sum, item) => sum + item.cantidad, 0),
            people: new Set(items.map((item) => item.clientId)).size,
            oldestDays: items[0]?.daysOut ?? 0,
            oldestClient: items[0]?.clientName ?? null,
          },
        },
        error: '',
      };
    });
    handler.current(rows, sale);
    if (session?.store) publishListMutation(session.store.id);
  };
  return {
    consignments: ready && state.scope === scope ? state.data : null,
    consignmentsError: state.scope === scope ? state.error : '',
    reloadConsignments,
    loadConsignmentOptions: () => api.fetchConsignmentOptions(auth()),
    addConsignments: async (input: api.ConsignmentInput) => {
      const result = await api.createConsignments(auth(), input);
      remember(result.items);
      await reloadConsignments();
    },
    collectConsignment: async (id: string, method: string) => {
      const result = await api.payConsignment(auth(), id, method);
      remember([result.consignment], result.sale);
      await reloadConsignments();
    },
  };
}
