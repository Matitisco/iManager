import { useStableState } from '../lib/stable-state';
import { useCallback, useEffect, useRef } from 'react';
import { canOpenSection } from '../desk/sections';
import {
  advanceRma as advanceRmaApi,
  archiveReturn as archiveReturnApi,
  createReturn as createReturnApi,
  fetchCreditNotes,
  fetchReturns,
  resolveReturn as resolveReturnApi,
  restoreReturn as restoreReturnApi,
  updateReturnDiagnosis as updateDiagnosisApi,
  updateReturn as updateReturnApi,
  type UpdateReturnInput,
  type CreditNoteView,
  type ResolveReturnInput,
  type ReturnCaseView,
  type ReturnInput,
  type RmaStatus,
} from '../services/returns-api';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { AuthUserLike } from '../types/auth-user';

export function useReturnsState(user: AuthUserLike | null, session: AppSession | null, status: BackendConnectionStatus) {
  const role = session?.membership?.role;
  const sections = session?.membership?.sections;
  const canReturns = Boolean(session?.store) && canOpenSection('sales', sections, role);
  const scope = `${user?.uid}:${session?.store?.id}:${role}:${JSON.stringify(sections)}`;
  const resolved = useRef('');
  const current = useRef(scope);
  current.current = scope;
  const [returns, setReturns] = useStableState<ReturnCaseView[] | null>(canReturns ? null : []);
  const [creditNotes, setCreditNotes] = useStableState<CreditNoteView[] | null>(canReturns ? null : []);
  const [returnsError, setReturnsError] = useStableState('');
  const ready = !!user && status === 'ready' && !!session?.store && !session.onboardingRequired;

  const reloadReturns = useCallback(async () => {
    if (!user || !ready) return;
    const ticket = scope;
    if (!canReturns) {
      if (current.current === ticket) {
        setReturns([]);
        setCreditNotes([]);
      }
      return;
    }
    try {
      const [claims, notes] = await Promise.all([fetchReturns(user), fetchCreditNotes(user)]);
      if (current.current === ticket) {
        resolved.current = scope;
        setReturns(claims);
        setCreditNotes(notes);
        setReturnsError('');
      }
    } catch (error) {
      if (current.current === ticket) {
        setReturns(old => old ?? []);
        setCreditNotes(old => old ?? []);
        if (resolved.current !== scope) setReturnsError(error instanceof Error ? error.message : 'No se pudieron cargar las devoluciones');
      }
    }
  }, [user?.uid, ready, scope, canReturns]);

  useEffect(() => {
    setReturns(canReturns ? null : []);
    setCreditNotes(canReturns ? null : []);
    setReturnsError('');
    void reloadReturns();
  }, [reloadReturns, canReturns]);

  const auth = () => {
    if (!user || !ready) throw new Error('El backend todavía no está listo. Volvé a intentar.');
    return user;
  };

  return {
    returns: ready ? returns : (canReturns ? null : []),
    creditNotes: ready ? creditNotes : (canReturns ? null : []),
    returnsError,
    reloadReturns,
    createReturn: async (input: ReturnInput) => {
      const saved = await createReturnApi(auth(), input);
      await reloadReturns();
      return saved;
    },
    updateReturn: async (id: string, input: UpdateReturnInput) => {
      const saved = await updateReturnApi(auth(), id, input);
      await reloadReturns();
      return saved;
    },
    updateReturnDiagnosis: async (id: string, diagnosis: string) => {
      const saved = await updateDiagnosisApi(auth(), id, diagnosis);
      await reloadReturns();
      return saved;
    },
    resolveReturn: async (id: string, input: ResolveReturnInput) => {
      const saved = await resolveReturnApi(auth(), id, input);
      await reloadReturns();
      return saved;
    },
    advanceRma: async (id: string, status: RmaStatus, stockStatus?: string | null, note?: string | null) => {
      const saved = await advanceRmaApi(auth(), id, status, stockStatus, note);
      await reloadReturns();
      return saved;
    },
    archiveReturn: async (id: string, reason?: string) => {
      await archiveReturnApi(auth(), id, reason);
      await reloadReturns();
    },
    restoreReturn: async (id: string) => {
      const saved = await restoreReturnApi(auth(), id);
      await reloadReturns();
      return saved;
    },
  };
}
