import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from 'nodemailer';
import { createSmtpMailer, smtpConfigured } from "./mail.js";

const sendMail = vi.hoisted(() => vi.fn());
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const message = { to: ['owner@example.test'], subject: 'Resumen', text: 'Texto', html: '<p>Texto</p>', idempotencyKey: 'report-existing-key' };

describe("correo SMTP", () => {
  it("no arma un enviador si falta el host o el remitente", () => {
    expect(createSmtpMailer({ SMTP_USER: "mailer@example.com", SMTP_PASS: "secret" })).toBeNull();
    expect(createSmtpMailer({ SMTP_HOST: "smtp.example.com" })).toBeNull();
    expect(smtpConfigured({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "reportes@example.com" })).toBe(true);
    expect(typeof createSmtpMailer({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "reportes@example.com", SMTP_PORT: "587" })).toBe("function");
  });
  it('preserves SMTP transport, sender and stable message headers without an API key', async () => {
    sendMail.mockResolvedValue({ accepted: message.to, rejected: [], messageId: 'smtp-id' });
    const mailer = createSmtpMailer({ SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'smtp@example.test', SMTP_PORT: '465' });
    await expect(mailer!(message)).resolves.toBe('smtp-id');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.example.test', port: 465, secure: true }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'smtp@example.test', to: 'owner@example.test', messageId: '<report-existing-key@reports.imanager>', headers: { 'Resend-Idempotency-Key': message.idempotencyKey } }));
  });
});

describe('correo Resend HTTP', () => {
  const env = { RESEND_API_KEY: ' test-key ', SMTP_FROM: ' iManager <reports@example.test> ', MAIL_FROM: 'other@example.test', SMTP_HOST: 'smtp.example.test' };
  it('prioritizes HTTP, forwards content and idempotency, and returns the provider id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'resend-id' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createSmtpMailer(env)!(message)).resolves.toBe('resend-id');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api.resend.com/emails', {
      method: 'POST', signal: expect.any(AbortSignal),
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey },
      body: JSON.stringify({ from: 'iManager <reports@example.test>', to: message.to, subject: message.subject, text: message.text, html: message.html }),
    });
  });
  it('uses MAIL_FROM without SMTP configuration and omits an absent idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'id' })));
    vi.stubGlobal('fetch', fetchMock);
    await createSmtpMailer({ RESEND_API_KEY: 'key', MAIL_FROM: ' reports@example.test ' })!({ ...message, idempotencyKey: undefined });
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body).from).toBe('reports@example.test');
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
    expect(createSmtpMailer({ RESEND_API_KEY: 'key', SMTP_HOST: 'smtp.example.test', SMTP_USER: 'resend' })).toBeNull();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
  it.each([
    [401, '{"message":"invalid api key"}'], [429, '{"message":"rate limited"}'], [500, '<html>error</html>'],
    [200, 'invalid json'], [200, '{}'], [200, 'null'], [200, '{"id":123}'], [200, '{"id":" "}'],
  ])('rejects HTTP %s or invalid response %s without SMTP fallback', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));
    await expect(createSmtpMailer(env)!(message)).rejects.toThrow();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
  it('propagates network failures and clears the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')));
    await expect(createSmtpMailer(env)!(message)).rejects.toThrow('network unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['headers', 'body'])('aborts after 15 seconds while awaiting %s', async stage => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal!;
      const stalled = () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      return stage === 'headers' ? stalled() : Promise.resolve({ ok: true, json: stalled });
    }));
    const result = createSmtpMailer(env)!(message);
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(14999);
    expect(signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
