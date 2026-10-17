import { describe, expect, it } from 'vitest';
import { BILLING_RETURN_WINDOW_MS, billingPathFromLocation, billingReturnStep, isBillingReturn } from './billing-return';

describe('retorno de Mercado Pago', () => {
  it('detecta la vuelta sin usar los valores para activar', () => {
    expect(isBillingReturn('#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1')).toBe(true);
    expect(isBillingReturn('#/plan', '?preapproval_id=pre-1&status=authorized')).toBe(true);
    expect(isBillingReturn('#/plan')).toBe(false);
  });
  it('limpia preapproval_id, status y external_reference del hash y de la query', () => {
    expect(billingPathFromLocation('https://app.imanager.com.ar/#/plan?preapproval_id=pre-1&status=authorized&external_reference=chk-1')).toBe('/#/plan');
    expect(billingPathFromLocation('https://app.imanager.com.ar/?preapproval_id=pre-1&status=authorized#/plan')).toBe('/#/plan');
    expect(billingPathFromLocation('https://app.imanager.com.ar/?lang=es#/plan?preapproval_id=pre-1')).toBe('/?lang=es#/plan');
  });
  it('confirma solo un alta reciente de esta tienda y no trata un retorno ajeno como error', () => {
    expect(billingReturnStep({ plan: 'BASIC', recentlyActivated: true }, 0)).toBe('success');
    expect(billingReturnStep({ pendingCheckout: true }, 0)).toBe('confirming');
    expect(billingReturnStep({ pendingCheckout: true }, BILLING_RETURN_WINDOW_MS)).toBe('pending');
    expect(billingReturnStep({ plan: 'TRIAL', status: 'TRIAL', pendingCheckout: false, recentlyActivated: false }, 0)).toBe('ignore');
    expect(billingReturnStep({ plan: 'BASIC', status: 'ACTIVE', recentlyActivated: false, pendingCheckout: false }, 0)).toBe('ignore');
  });
});
