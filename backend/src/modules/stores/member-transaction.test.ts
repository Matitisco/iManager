import { beforeEach, describe, expect, it, vi } from 'vitest';
const transaction = vi.hoisted(() => vi.fn());
vi.mock('../../plugins/prisma.js', () => ({ prisma: { $transaction: transaction } }));
import { withMembershipTransaction } from './member-transaction.js';

beforeEach(() => transaction.mockReset());
describe('reintentos de transacciones de miembros', () => {
  it.each([{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { code: '40P01' } }])('reintenta conflictos ORM/SQL %j', async error => {
    transaction.mockRejectedValueOnce(error).mockResolvedValueOnce('ok');
    expect(await withMembershipTransaction(async () => 'ok')).toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 20_000,
    });
  });
  it('limita a tres intentos y devuelve un conflicto sin detalles internos', async () => {
    transaction.mockRejectedValue({ code: 'P2034', message: 'SQL interno' });
    try {
      await expect(withMembershipTransaction(async () => 'ok')).rejects.toMatchObject({
        statusCode: 409, message: 'La operación coincidió con otro cambio. Volvé a intentarlo.',
      });
      expect(transaction).toHaveBeenCalledTimes(3);
    } finally { transaction.mockReset(); }
  });
  it.each([{ statusCode: 403 }, { code: 'P2002' }, { code: 'P2010', meta: { code: '22003' } }])('no reintenta errores de permisos, unicidad u otros SQL %j', async error => {
    transaction.mockRejectedValue(error);
    try {
      await expect(withMembershipTransaction(async () => 'ok')).rejects.toBe(error);
      expect(transaction).toHaveBeenCalledTimes(1);
    } finally { transaction.mockReset(); }
  });
});
