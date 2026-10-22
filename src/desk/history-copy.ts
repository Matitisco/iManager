import { isSectionHidden } from '../config/hiddenSections';
import type { HistoryEvent } from '../services/history-api';
export type HistoryDetailRow = { label: string; before: string | null; after: string | null };

const OPENABLE = new Set(['inventory', 'sales', 'tradeins', 'service', 'clients', 'suppliers', 'expenses', 'returns']);

export function historyAction(event: { verb?: string | null; target?: string | null; suffix?: string | null }) {
  return [event.verb, event.target, event.suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
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

export function historyDetailRows(event: { changes?: HistoryDetailRow[] | null; detail?: string | null }): HistoryDetailRow[] {
  return (event.changes ?? []).filter((row) => row.label?.trim() && (row.before != null || row.after != null));
}

/** Retain the saved label; a live identifier may complete its shortened IMEI. */
export function historyRecord(event: Pick<HistoryEvent, 'entityLabel' | 'entityIdentifier' | 'target'>) {
  const label = event.entityLabel?.trim() || event.target?.trim() || 'Registro';
  const imei = label.match(/\s*·?\s*(IMEI\s+[^·]+)$/i);
  const title = (imei ? label.slice(0, imei.index).trim() : label)
    .replace(/\s+(\d+\s*(?:GB|TB))\b/i, ' · $1');
  return { title, identifier: event.entityIdentifier?.trim() || imei?.[1]?.trim() || null };
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});
const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: 'short', year: 'numeric',
});

export function groupHistoryDays(events: HistoryEvent[], now = new Date()) {
  const today = DAY_FORMAT.format(now);
  const yesterday = DAY_FORMAT.format(new Date(now.getTime() - 86400000));
  const groups = new Map<string, { key: string; label: string; rows: HistoryEvent[] }>();
  for (const event of [...events].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))) {
    const date = new Date(event.createdAt);
    const key = DAY_FORMAT.format(date);
    let day = groups.get(key);
    if (!day) {
      const prefix = key === today ? 'Hoy · ' : key === yesterday ? 'Ayer · ' : '';
      day = { key, label: `${prefix}${DATE_FORMAT.format(date).replace(/\./g, '').replace(/ de /g, ' ')}`, rows: [] };
      groups.set(key, day);
    }
    day.rows.push(event);
  }
  return [...groups.values()];
}
