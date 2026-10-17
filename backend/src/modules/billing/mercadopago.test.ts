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
  it('rechaza el webhook si falta el secreto', () => {
    expect(validSignature('abc', 'req', 'ts=123,v1=' + 'ab'.repeat(32), '')).toBe(false);
    expect(validSignature('abc', 'req', 'ts=123,v1=' + 'ab'.repeat(32), '   ')).toBe(false);
    expect(validSignature('abc', undefined, undefined, undefined)).toBe(false);
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
  it('un 400 al crear la suscripción no habla de la tarjeta y el log no guarda token ni email', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-placeholder');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Invalid card_token_id test-placeholder for payer@example.com',
      cause: [{ code: 2062, description: 'card_token_id=secret-token payer@example.com' }, { code: 'cc_rejected' }],
    }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const error = await mpRequest('/preapproval', 'POST', { payer_email: 'payer@example.com' }).then(() => null, (cause: unknown) => cause);
    expect(error).toMatchObject({
      statusCode: 402,
      message: 'Mercado Pago no pudo iniciar la suscripción. Revisá el email del pagador o probá de nuevo en unos minutos.',
      logContext: { status: 400, message: 'Invalid card_token_id [redacted] for [redacted-email]', causes: [2062, 'cc_rejected'], kind: 'provider' },
    });
    expect(JSON.stringify(error)).not.toContain('secret-token');
    expect(JSON.stringify(error)).not.toContain('test-placeholder');
    expect(JSON.stringify(error)).not.toContain('payer@example.com');
    expect(JSON.stringify(error)).not.toContain('tarjeta');
  });
  it('separa credenciales, cuentas mixtas y la validación del plan', async () => {
    vi.stubEnv('MP_ACCESS_TOKEN', 'test-placeholder');
    const respond = (status: number, message: string) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ message }), { status }));
    vi.stubGlobal('fetch', respond(401, 'invalid access token test-placeholder'));
    await expect(mpRequest('/preapproval', 'POST', { payer_email: 'buyer@example.com' })).rejects.toMatchObject({
      statusCode: 503,
      message: 'La facturación no está disponible en este momento. Contactá a iManager.',
      logContext: { kind: 'config', status: 401, message: 'invalid access token [redacted]' },
    });
    vi.stubGlobal('fetch', respond(403, 'forbidden'));
    await expect(mpRequest('/users/me')).rejects.toMatchObject({ statusCode: 503, logContext: { kind: 'config', status: 403 } });
    vi.stubGlobal('fetch', respond(400, 'Both payer and collector must be real or test users. payer buyer@example.com'));
    const mixed = await mpRequest('/preapproval', 'POST', {}).then(() => null, (cause: unknown) => cause);
    expect(mixed).toMatchObject({
      statusCode: 402,
      message: 'Este email no se puede usar con la cuenta de cobro actual. Probá con otro email o contactá a iManager.',
      logContext: { status: 400, message: 'Both payer and collector must be real or test users. payer [redacted-email]', kind: 'provider' },
    });
    expect(JSON.stringify(mixed)).not.toContain('buyer@example.com');
    expect(JSON.stringify(mixed)).not.toContain('tarjeta');
    vi.stubGlobal('fetch', respond(422, 'invalid plan'));
    await expect(mpRequest('/preapproval_plan/plan-1', 'PUT', { auto_recurring: {} }, { purpose: 'plan' })).rejects.toMatchObject({
      statusCode: 402,
      message: 'No pudimos validar el plan con Mercado Pago. Reintentá.',
    });
    vi.stubGlobal('fetch', respond(404, 'plan not found buyer@example.com'));
    await expect(mpRequest('/preapproval_plan/missing', 'GET', undefined, { purpose: 'plan' })).rejects.toMatchObject({
      statusCode: 402,
      message: 'No pudimos validar el plan con Mercado Pago. Reintentá.',
    });
    vi.stubGlobal('fetch', respond(404, 'missing'));
    await expect(mpRequest('/preapproval/missing')).rejects.toMatchObject({
      statusCode: 502,
      message: 'No pudimos consultar Mercado Pago. Reintentá en unos minutos.',
    });
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
