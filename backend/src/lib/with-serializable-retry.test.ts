import { beforeEach, expect, it, vi } from 'vitest';
const transaction = vi.hoisted(() => vi.fn());
vi.mock('../plugins/prisma.js', () => ({ prisma: { $transaction: transaction } }));
import { withSerializableRetry } from './with-serializable-retry.js';
import Fastify from 'fastify';
import { registerApiErrorHandler } from './api-error.js';
beforeEach(() => transaction.mockReset());
it.each([{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { code: '40P01' } }])('retries ORM and raw SQL serialization failures %j', async failure => {
  transaction.mockRejectedValueOnce(failure).mockResolvedValueOnce('ok');
  expect(await withSerializableRetry(async () => 'ok')).toBe('ok');
  expect(transaction).toHaveBeenCalledTimes(2);
});
it.each([{ code: 'P2010', meta: { code: '22003' } }, { code: 'P2002', meta: { target: ['imei'] } }])('does not retry validation or non-serialization errors %j', async failure => {
  transaction.mockRejectedValue(failure);
  try {
    await expect(withSerializableRetry(async () => 'ok')).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  } finally {
    // A permanent rejection is invoked again while the mocked module is torn down.
    transaction.mockReset();
  }
});
it('responds with a safe HTTP conflict when retries are exhausted', async () => {
  const app = Fastify({ logger: false });
  registerApiErrorHandler(app);
  app.post('/operation', () => withSerializableRetry(async () => 'ok', 1));
  transaction.mockRejectedValue({ code: 'P2034', message: 'private SQL and connection details' });
  try {
    const response = await app.inject({ method: 'POST', url: '/operation' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'La operación coincidió con otro cambio. Volvé a intentarlo.' });
    expect(transaction).toHaveBeenCalledTimes(1);
  } finally {
    transaction.mockReset();
    await app.close();
  }
});
it('limits repeated conflicts to five attempts and returns an actionable conflict', async () => {
  transaction.mockRejectedValue({ code: 'P2034' });
  try {
    await expect(withSerializableRetry(async () => 'ok')).rejects.toMatchObject({ statusCode: 409, message: 'La operación coincidió con otro cambio. Volvé a intentarlo.' });
    expect(transaction).toHaveBeenCalledTimes(5);
  } finally {
    transaction.mockReset();
  }
});
