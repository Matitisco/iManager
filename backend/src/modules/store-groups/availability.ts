import type { InventoryItem } from '@prisma/client';
import { DomainError } from '../../lib/domain-error.js';

export function assertTransferAvailable(
  item: Pick<
    InventoryItem,
    | 'status'
    | 'archivedAt'
    | 'reservedDepositId'
    | 'pendingSaleRegistration'
    | 'cantidad'
    | 'imei'
  >,
  quantity: number,
  pendingConsignment: boolean,
  activeSale: boolean,
) {
  if (
    item.archivedAt ||
    item.status !== 'DISPONIBLE' ||
    item.reservedDepositId ||
    item.pendingSaleRegistration ||
    pendingConsignment ||
    (item.imei && activeSale)
  ) {
    throw new DomainError(
      'El equipo no está disponible: revisá ventas, señas y consignaciones.',
      409,
    );
  }
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new DomainError('Indicá una cantidad entera mayor a cero.', 400);
  if (quantity > item.cantidad || (item.imei && quantity !== 1))
    throw new DomainError('La cantidad supera el stock disponible.', 409);
}
