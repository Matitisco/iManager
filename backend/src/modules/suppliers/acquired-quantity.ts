import { storedStateFilter } from '../../lib/accounting-states.js';
import { prisma } from '../../plugins/prisma.js';
import { DomainError } from '../../lib/domain-error.js';

/** Nullable compatibility during rollout; same reconstruction as the additive backfill.
 * Read only: never replace a known snapshot with mutable stock. */
export async function resolveAcquiredQuantities(storeId: string, items: { id: string; acquiredQuantity: number | null }[]) {
  const missing = items.filter(item => item.acquiredQuantity === null);
  if (!missing.length) return;
  const rows = await prisma.inventoryItem.findMany({
    where: { storeId, id: { in: missing.map(item => item.id) } },
    select: {
      id: true, cantidad: true,
      sales: { where: { storeId, stockDeducted: true, voidedAt: null, status: await storedStateFilter(prisma, 'Sale', storeId, ["CANCELADA","ANULADA"], true) }, select: { cantidad: true } },
      // Archiving/voiding a resolved claim does not undo its physical effects.
      returnCases: { where: { storeId, destination: { in: ['STOCK', 'PROVEEDOR'] }, resolution: { not: null } },
        select: { cantidad: true, resolution: true, rmaStatus: true, sale: { select: { storeId: true, cantidad: true, stockDeducted: true } } } },
    },
  });
  const quantities = new Map(rows.map(row => {
    const sold = row.sales.reduce((sum, sale) => sum + sale.cantidad, 0);
    const returned = row.returnCases.reduce((sum, claim) => {
      if (!claim.sale || claim.sale.storeId !== storeId || !claim.sale.stockDeducted && claim.sale.cantidad === 1) return sum;
      if (claim.sale.stockDeducted && claim.resolution === 'REPARACION' && claim.rmaStatus === 'RECIBIDO') return sum;
      return sum + (claim.cantidad ?? claim.sale.cantidad);
    }, 0);
    const quantity = row.cantidad + sold - returned;
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      throw new DomainError('No se puede reconstruir la cantidad adquirida de esta compra. Revisá su historial de stock.', 409);
    }
    return [row.id, quantity] as const;
  }));
  for (const item of missing) {
    const quantity = quantities.get(item.id);
    if (quantity === undefined) throw new DomainError('El inventario cambió al consultar esta compra. Volvé a intentarlo.', 409);
    item.acquiredQuantity = quantity;
  }
}
