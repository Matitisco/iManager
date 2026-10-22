import { isSectionHidden } from '../config/hiddenSections';
import { statusLabel } from './format';
export type HistoryDetailRow = { label: string; before: string | null; after: string | null };

const OPENABLE = new Set(['inventory', 'sales', 'tradeins', 'service', 'clients', 'suppliers', 'expenses', 'returns']);
const OPAQUE = /^(?:sin vendedor|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const CATALOG = /^(ocultar|mostrar):\s*(\d+)\s+equipos?$/i;

export function historyAction(event: { verb?: string | null; target?: string | null; suffix?: string | null }) {
  return [event.verb, event.target, event.suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function historyRecordAction(event: { action?: string; changes?: HistoryDetailRow[] | null; verb?: string | null; target?: string | null; suffix?: string | null }) {
  if (event.action === 'repair.status') {
    const status = event.changes?.find(change => change.label === 'Estado')?.after;
    if (status) return `Pasó a ${statusLabel(status)}`;
  }
  return historyAction(event);
}

export function historySentence(event: { actorName?: string | null; verb?: string | null; target?: string | null; suffix?: string | null }) {
  return `${event.actorName?.trim() || 'Alguien'} ${historyAction(event)}`.replace(/\s+/g, ' ').trim();
}

export function historyRecordNote(event: { legacy: boolean; recordState: string; section: string; entityType?: string }) {
  if (isSectionHidden(event.section)) return 'Sección temporalmente oculta';
  if (event.entityType === 'stockcount' && event.recordState === 'active') return 'Está en Control de stock, dentro de Inventario.';
  const openable = !event.legacy
    && (event.recordState === 'active' || event.recordState === 'archived' || event.recordState === 'voided')
    && OPENABLE.has(event.section);
  if (openable) return null;
  if (event.legacy) return 'Movimiento anterior al historial: no tiene detalle';
  return 'El registro ya no existe';
}

export function historyDetailRows(event: { action?: string; changes?: HistoryDetailRow[] | null; detail?: string | null }): HistoryDetailRow[] {
  const changes = (event.changes ?? []).filter((row) => row.label?.trim()).map(row =>
    (event.action === 'repair.status' || event.action === 'repair.created') && row.label === 'Estado'
      ? { ...row, before: row.before ? statusLabel(row.before) : null, after: row.after ? statusLabel(row.after) : null }
      : row,
  );
  if (changes.length) return changes;
  const detail = event.detail?.trim() ?? '';
  if (!detail) return [];
  const catalog = detail.match(CATALOG);
  if (catalog) {
    const hide = catalog[1].toLowerCase() === 'ocultar';
    return [
      { label: 'Catálogo', before: hide ? 'Visible' : 'Oculto', after: hide ? 'Oculto' : 'Visible' },
      { label: 'Equipos', before: null, after: catalog[2] },
    ];
  }
  const arrow = detail.match(/^(.+?)\s*(?:→|->)\s*(.+)$/);
  if (arrow) {
    const before = arrow[1].trim();
    const after = arrow[2].trim();
    if (OPAQUE.test(before) && OPAQUE.test(after)) return [];
    return [{ label: 'Cambio', before, after }];
  }
  const labeled = detail.match(/^([^:]{1,40}):\s*(.+)$/);
  if (labeled) return [{ label: labeled[1].trim(), before: null, after: labeled[2].trim() }];
  return [{ label: 'Detalle', before: null, after: detail }];
}
