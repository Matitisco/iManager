import { beforeEach, expect, it, vi } from 'vitest';
const transaction = vi.hoisted(() => vi.fn());
vi.mock('../plugins/prisma.js', () => ({ prisma: { $transaction: transaction } }));
import { withSerializableRetry } from './with-serializable-retry.js';
beforeEach(() => transaction.mockReset());
it.each([{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { code: '40P01' } }])('retries ORM and raw SQL serialization failures %j', async failure => {
  transaction.mockRejectedValueOnce(failure).mockResolvedValueOnce('ok');
  expect(await withSerializableRetry(async () => 'ok')).toBe('ok');
  expect(transaction).toHaveBeenCalledTimes(2);
});
it('does not retry validation or arbitrary raw errors', async () => {
  const failure = { code: 'P2010', meta: { code: '22003' } };
  transaction.mockRejectedValue(failure);
  await expect(withSerializableRetry(async () => 'ok')).rejects.toBe(failure);
  expect(transaction).toHaveBeenCalledTimes(1);
});
it('limits repeated conflicts to three attempts', async () => {
  transaction.mockRejectedValue({ code: 'P2034' });
  await expect(withSerializableRetry(async () => 'ok')).rejects.toMatchObject({ code: 'P2034' });
  expect(transaction).toHaveBeenCalledTimes(3);
});
