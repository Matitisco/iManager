import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthUserLike } from '../types/auth-user';
import type { BillingDetails, BillingPlanKey } from '../types/billing';
import { cancelBilling, checkoutBilling, fetchBilling, quoteBilling } from '../services/billing-api';

export function useBillingState(user: AuthUserLike | null, storeId?: string, role?: string) {
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const scope = `${user?.uid ?? ''}:${storeId ?? ''}:${role ?? ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  useEffect(() => { setBillingDetails(null); }, [scope]);
  const requireOwner = () => {
    if (!user || !storeId || role !== 'OWNER') throw new Error('Solo el propietario puede administrar el plan.');
    return user;
  };
  const loadBilling = useCallback(async (refresh = false, replaceAbandoned = false) => {
    if (!user || !storeId || role !== 'OWNER') return;
    const result = await fetchBilling(user, refresh, replaceAbandoned);
    if (scopeRef.current === scope) setBillingDetails(result);
    return result;
  }, [user, storeId, role, scope]);
  return {
    billingDetails, loadBilling,
    quoteSubscription: (key: BillingPlanKey, email: string) => quoteBilling(requireOwner(), key, email),
    openSubscriptionCheckout: (id: string) => checkoutBilling(requireOwner(), id),
    cancelSubscription: () => cancelBilling(requireOwner()),
  };
}
