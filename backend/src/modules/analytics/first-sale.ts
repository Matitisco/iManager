import { prisma } from '../../plugins/prisma.js';
import { track, log } from './track.js';

/** Check after commit, including concurrent writes and older stores with existing sales. */
export async function trackFirstSale(storeId: string, saleId: string, source: 'form' | 'import', userId?: string) {
  try {
    if (process.env.ANALYTICS_DISABLED === '1') return;
    const first = await prisma.sale.findFirst({ where: { storeId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
    if (first?.id === saleId) await track({ name: 'first_sale', storeId, userId, props: { source }, dedupeKey: `first_sale:${storeId}` });
  } catch { try { log.warn(); } catch { /* best effort */ } }
}
