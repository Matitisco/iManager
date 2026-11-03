import type { InventoryItem, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DomainError } from '../../lib/domain-error.js';
import { moneyChanged, writeAudit, type Actor } from '../audit/audit.js';
import { deviceLabel } from '../audit/archive.js';
import { diffFields, MONEY } from '../audit/diff-fields.js';

/** Unit cost stays in the item's currency. Caller owns the sale transaction/stock lock. */
export async function applySaleItemCost(
  tx: Prisma.TransactionClient,
  storeId: string,
  item: InventoryItem | null,
  cost: number | undefined,
  actor?: Actor | null,
) {
  if (cost === undefined) return item;
  if (!item) throw new DomainError('Vinculá un equipo para cargar su costo', 400);
  if (!moneyChanged(item.cost, cost)) return item;
  const updated = await tx.inventoryItem.update({
    where: { id: item.id, storeId },
    data: {
      cost: new Decimal(cost),
      ...(actor ? { costChangedBy: actor.name, costChangedAt: new Date() } : {}),
    },
  });
  await writeAudit(tx, {
    storeId, actor, action: 'inventory.cost', entityType: 'inventory', entityId: item.id,
    entityLabel: deviceLabel(item), detail: `${item.cost.toString()} → ${cost}`,
    changes: diffFields({ cost: item.cost }, { cost }, [{ field: 'cost', label: 'Costo', format: MONEY }]),
  });
  return updated;
}
