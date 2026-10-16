import { describe, expect, it } from 'vitest';
import { mercadoPagoCheckoutUrl } from './mercadopago-url';

describe('checkout hospedado', () => {
  it('acepta el init_point de Mercado Pago', () => {
    expect(mercadoPagoCheckoutUrl('https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc')).toContain('preapproval_id=abc');
  });
  it.each([
    'http://www.mercadopago.com.ar/subscriptions/checkout',
    'https://evil.example/mercadopago.com.ar',
    'https://user:pass@www.mercadopago.com.ar/checkout',
    'javascript:alert(1)',
  ])('rechaza %s', value => {
    expect(() => mercadoPagoCheckoutUrl(value)).toThrow(/No pudimos abrir Mercado Pago/);
  });
});
