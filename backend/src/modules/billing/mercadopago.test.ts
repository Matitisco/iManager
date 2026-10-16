import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertMercadoPagoCheckoutUrl, mpRequest, validSignature } from './mercadopago.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('cliente Mercado Pago', () => {
  it('valida el manifiesto exacto, lowercase de data.id y comparación constante', () => {
    const hash = createHmac('sha256', 'test-secret').update('id:abc;request-id:req;ts:123;').digest('hex');
    const now = 123_000;
    expect(validSignature('ABC', 'req', `ts=123,v1=${hash}`, 'test-secret', now)).toBe(true);
    expect(validSignature('def', 'req', `ts=123,v1=${hash}`, 'test-secret', now)).toBe(false);
    expect(validSignature('abc', 'req-other', `ts=123,v1=${hash}`, 'test-secret', now)).toBe(false);
    expect(validSignature('abc', 'req', `ts=123,v1=${hash}`, 'another-secret', now)).toBe(false);
  });
  it.each([undefined, 'ts=1', 'ts=1,v1=zz', 'ts=1,v1=aa', 'ts=1,ts=2,v1=' + 'a'.repeat(64)])('rechaza firma mal formada %s', signature => {
    expect(validSignature('abc', 'req', signature, 'secret')).toBe(false);
  });
  it('rechaza una firma vencida o adelantada', () => {
    const now = 1_700_000_000_000;
    const sign = (ts: number) => {
      const hash = createHmac('sha256', 'secret').update(`id:abc;request-id:req;ts:${ts};`).digest('hex');
      return validSignature('abc', 'req', `ts=${ts},v1=${hash}`, 'secret', now);
    };
    const fresh = Math.floor(now / 1000);
    expect(sign(fresh)).toBe(true);
    expect(sign(fresh - 301)).toBe(false);
    expect(sign(fresh + 301)).toBe(false);
  });
  it('omite la validación únicamente sin secreto', () => {
    expect(validSignature('abc', undefined, undefined, '')).toBe(true);
    expect(validSignature('abc', undefined, undefined, 'secret')).toBe(false);
  });
  it('usa solo el token del entorno sin devolver el cuerpo del proveedor al fallar', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-placeholder');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"provider detail"}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await mpRequest('/preapproval/abc').then(() => null, (cause: unknown) => cause);
    expect(error).toMatchObject({ statusCode: 502, message: 'No pudimos consultar Mercado Pago. Reintentá en unos minutos.', logContext: { status: 503, causes: [] } });
    expect(JSON.stringify(error)).not.toContain('provider detail');
    expect(fetchMock).toHaveBeenCalledWith('https://api.mercadopago.com/preapproval/abc', expect.objectContaining({ headers: { Authorization: 'Bearer test-placeholder' } }));
  });
  it('un 4xx de Mercado Pago es 402 y el log solo guarda status, mensaje y códigos', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-placeholder');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Invalid card_token_id test-placeholder',
      cause: [{ code: 2062, description: 'card_token_id=secret-token' }, { code: 'cc_rejected' }],
    }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await mpRequest('/preapproval', 'POST', { card_token_id: 'secret-token' }).then(() => null, (cause: unknown) => cause);
    expect(error).toMatchObject({
      statusCode: 402,
      message: 'Mercado Pago rechazó el pago. Revisá los datos de la tarjeta o probá con otra.',
      logContext: { status: 400, message: 'Invalid card_token_id [redacted]', causes: [2062, 'cc_rejected'] },
    });
    expect(JSON.stringify(error)).not.toContain('secret-token');
    expect(JSON.stringify(error)).not.toContain('test-placeholder');
  });
  it('solo acepta un init_point https de Mercado Pago', () => {
    expect(assertMercadoPagoCheckoutUrl('https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc')).toContain('mercadopago.com.ar');
    expect(() => assertMercadoPagoCheckoutUrl('https://evil.example/mercadopago.com.ar')).toThrow(/no devolvió el checkout/);
    expect(() => assertMercadoPagoCheckoutUrl('http://www.mercadopago.com.ar/checkout')).toThrow(/no devolvió el checkout/);
  });
  it('sin token no hace solicitudes remotas', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', ''); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(mpRequest('/users/me')).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
