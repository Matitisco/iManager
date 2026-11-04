import type { CatalogSettings, ManagedCatalogItem } from '../types/public-catalog';
import { catalogBatteryMinimum } from './presentation';

export function draftCatalogReason(item: ManagedCatalogItem, settings: CatalogSettings, hidden: boolean): string | null {
  if (item.needsCompletion) return 'No disponible';
  if (settings.hideWithoutStock && ((item.cantidad ?? 1) <= 0 || ['VENDIDO', 'SIN_STOCK'].includes(item.status ?? ''))) return 'Regla: sin stock';
  if (settings.hideReserved && item.status === 'RESERVADO') return 'Regla: reservado';
  const battery = catalogBatteryMinimum(item.batteryHealth);
  if (settings.minBattery != null && (battery == null || battery < settings.minBattery)) return `Regla: batería < ${settings.minBattery} %`;
  return hidden ? 'Oculto a mano' : null;
}
