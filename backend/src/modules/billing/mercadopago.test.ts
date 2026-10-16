import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hostedCheckout, mpRequest, validSignature } from './mercadopago.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('cliente Mercado Pago', () => {
  it('valida el manifiesto exacto, lowercase de data.id y comparación constante', () => {
    const hash = createHmac('sha256', 'test-secret').update('id:abc;request-id:req;ts:123;').digest('hex');
    expect(validSignature('ABC', 'req', `ts=123,v1=${hash}`, 'test-secret')).toBe(true);
    expect(validSignature('def', 'req', `ts=123,v1=${hash}`, 'test-secret')).toBe(false);
    expect(validSignature('abc', 'req-other', `ts=123,v1=${hash}`, 'test-secret')).toBe(false);
    expect(validSignature('abc', 'req', `ts=123,v1=${hash}`, 'another-secret')).toBe(false);
  });
  it.each([undefined, 'ts=1', 'ts=1,v1=zz', 'ts=1,v1=aa', 'ts=1,ts=2,v1=' + 'a'.repeat(64)])('rechaza firma mal formada %s', signature => {
    expect(validSignature('abc', 'req', signature, 'secret')).toBe(false);
  });
  it('omite la validación únicamente sin secreto', () => {
    expect(validSignature('abc', undefined, undefined, '')).toBe(true);
    expect(validSignature('abc', undefined, undefined, 'secret')).toBe(false);
  });
  it('usa solo el token del entorno sin devolver el cuerpo del proveedor al fallar', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-placeholder');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"provider detail"}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(mpRequest('/preapproval/abc')).rejects.toMatchObject({ statusCode: 502, message: 'No pudimos consultar Mercado Pago. Reintentá en unos minutos.' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.mercadopago.com/preapproval/abc', expect.objectContaining({ headers: { Authorization: 'Bearer test-placeholder' } }));
  });
  it('sin token no hace solicitudes remotas', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', ''); const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(mpRequest('/users/me')).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('el enlace conserva plan y agrega referencia y email sin permitir otro host', () => {
    const url = new URL(hostedCheckout('https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan', 'store-1', 'owner+1@example.com'));
    expect(url.searchParams.get('external_reference')).toBe('store-1');
    expect(url.searchParams.get('payer_email')).toBe('owner+1@example.com');
    expect(url.searchParams.get('preapproval_plan_id')).toBe('plan');
    expect(() => hostedCheckout('https://evil.test/subscriptions/checkout', 'id', 'email')).toThrow();
    expect(() => hostedCheckout('http://www.mercadopago.com.ar/subscriptions/checkout', 'id', 'email')).toThrow();
  });
});
