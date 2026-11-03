import { Decimal } from '@prisma/client/runtime/library';
import { expect, it, vi } from 'vitest';
const findFirst = vi.hoisted(() => vi.fn());
vi.mock('../../plugins/prisma.js', () => ({ prisma: { sale: { findFirst } } }));
import { getSaleOperation } from './operations.service.js';

it('conserva la hora de carga al refrescar una operación sin modificar su fecha comercial', async () => {
  findFirst.mockResolvedValue({
    id: 'sale-1', saleNumber: 7, createdAt: new Date('2026-11-03T14:32:01.123Z'),
    soldAt: new Date('2026-10-01T03:00:00Z'), dateLabel: '01/10/2026',
    status: 'COMPLETADA', amount: new Decimal(100), depositAppliedAmount: new Decimal(0), clientName: 'Mostrador',
  });
  const result = await getSaleOperation('store-1', 'sale-1');
  expect(result.sale).toMatchObject({ createdAt: '2026-11-03T14:32:01.123Z', date: '01/10/2026' });
  expect(findFirst).toHaveBeenCalledWith({ where: { id: 'sale-1', storeId: 'store-1' } });
});
