import { useRef, useState } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import type { AppSession, BackendConnectionStatus } from '../types/app-session';
import type { CommissionSummary, CommissionDetail, CommissionRule, CommissionRuleInput, CommissionPaymentInput, CommissionSeller } from '../types/commissions';
import * as api from '../services/commissions-api';
import { canManageCommissions } from '../desk/sections';

export function useCommissionState(user: AuthUserLike | null, session: AppSession | null, status: BackendConnectionStatus) {
  const scope = `${user?.uid}:${session?.store?.id}:${session?.membership?.role}:${JSON.stringify(session?.membership?.sections)}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [data, setData] = useState<{ scope: string; summaries: Record<string, CommissionSummary>; details: Record<string, CommissionDetail>; rules: CommissionRule[]; sellers: CommissionSeller[] }>({ scope, summaries: {}, details: {}, rules: [], sellers: [] });
  const current = data.scope === scope ? data : { scope, summaries: {}, details: {}, rules: [], sellers: [] };
  const auth = () => {
    if (!user || status !== 'ready' || !session?.store || session.onboardingRequired) throw new Error('El backend todavía no está listo. Reintentá en unos segundos.');
    return user;
  };
  const merge = (patch: Partial<typeof data>) => {
    if (scopeRef.current !== scope) return;
    setData(old => ({ ...(old.scope === scope ? old : { scope, summaries: {}, details: {}, rules: [], sellers: [] }), ...patch }));
  };
  const loadCommissions = async (period: string) => {
    const actor = auth();
    if (canManageCommissions(session?.membership?.sections, session?.membership?.role)) {
      const [summary, rules] = await Promise.all([api.fetchCommissionSummary(actor, period), api.fetchCommissionRules(actor)]);
      if (!Array.isArray(summary.people) || !summary.summary || !summary.period) throw new Error('Respuesta inválida de comisiones');
      if (scopeRef.current === scope) setData(old => ({ ...(old.scope === scope ? old : current), scope, summaries: { ...(old.scope === scope ? old.summaries : {}), [period]: summary }, rules }));
    } else {
      const detail = await api.fetchMyCommissions(actor, period);
      if (!detail.person || !detail.period) throw new Error('Respuesta inválida de comisiones');
      if (scopeRef.current === scope) setData(old => ({ ...(old.scope === scope ? old : current), scope, details: { ...(old.scope === scope ? old.details : {}), [`mine:${period}`]: detail } }));
    }
  };
  const loadCommissionDetail = async (memberId: string, period: string) => {
    const detail = await api.fetchCommissionMember(auth(), memberId, period);
    if (scopeRef.current === scope) setData(old => ({ ...(old.scope === scope ? old : current), scope, details: { ...(old.scope === scope ? old.details : {}), [`${memberId}:${period}`]: detail } }));
    return detail;
  };
  return {
    commissionSummaries: current.summaries, commissionDetails: current.details, commissionRules: current.rules, commissionSellers: current.sellers,
    loadCommissions, loadCommissionDetail,
    loadCommissionSellers: async () => { const sellers = await api.fetchCommissionSellers(auth()); merge({ sellers }); },
    saveCommissionRule: async (input: CommissionRuleInput) => { await api.createCommissionRule(auth(), input); merge({ rules: await api.fetchCommissionRules(auth()) }); },
    payCommission: async (input: CommissionPaymentInput) => {
      const payment = await api.createCommissionPayment(auth(), input);
      try { await Promise.all([loadCommissions(input.period), loadCommissionDetail(input.memberId, input.period)]); return { payment, refreshError: '' }; }
      catch { merge({ summaries: {}, details: {} }); return { payment, refreshError: 'El pago se registró, pero no se pudo actualizar el saldo. Cerrá y volvé a cargar las comisiones. No lo registres otra vez.' }; }
    },
    assignCommissionSeller: async (saleIds: string[], memberId: string | null) => { await api.assignSalesSeller(auth(), saleIds, memberId); merge({ summaries: {}, details: {} }); },
  };
}
