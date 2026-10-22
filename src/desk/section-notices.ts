import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatMoney } from './format';
import type { OperationNotification } from '../services/operations-api';
import type { NoticeSection } from './unread-count';
import type { RecordVersion } from '../services/section-views-api';

const PHONE_QUERY = '(max-width: 760px)';

export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return phone;
}

/** Keep the observed versions pinned for this visit even after the backend acknowledges them. */
export function useSectionNotices(section: NoticeSection) {
  const { sectionChanges = {}, viewSection, user, appSession } = useAppContext();
  const scope = `${user?.uid}:${appSession?.store?.id}:${appSession?.membership?.role}:${JSON.stringify(appSession?.membership?.sections)}:${section}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; ids: Set<string> }>({ scope, ids: new Set() });
  const pending = useRef(new Set<string>());
  const observed = useRef<RecordVersion[] | null>(null);
  const currentScope = useRef(scope);
  if (currentScope.current !== scope) {
    currentScope.current = scope;
    pending.current = new Set();
    observed.current = null;
  }
  const available = sectionChanges[section];
  useEffect(() => {
    if (!available || typeof viewSection !== 'function') return;
    // Freeze this visit's versions. Polls can discover later changes while the
    // business list is still showing older data; leave those for the next visit.
    if (observed.current === null) {
      observed.current = available;
      setSnapshot({ scope, ids: new Set(available.map(row => row.id)) });
    }
    const versions = observed.current;
    const unseen = versions.filter(row => !pending.current.has(`${row.id}:${row.updatedAt}`));
    if (!unseen.length) return;
    const requested = pending.current;
    for (const row of unseen) requested.add(`${row.id}:${row.updatedAt}`);
    void viewSection(section, unseen).catch(() => {
      // Error is shown by the shell; retry via refresh or the next section visit.
      for (const row of unseen) requested.delete(`${row.id}:${row.updatedAt}`);
    });
  }, [available, scope, section, viewSection]);
  const ids = snapshot.scope === scope ? snapshot.ids : new Set<string>();
  return {
    count: ids.size,
    key: [...ids].join('|'),
    reasonFor: (id: string) => ids.has(id) ? 'Actualizado' : '',
    prioritize: <T extends { id: string }>(rows: T[]) => prioritizeNovelties(rows, ids),
  };
}

export function prioritizeNovelties<T extends { id: string }>(rows: T[], changed: ReadonlySet<string>): T[] {
  return [...rows.filter(row => changed.has(row.id)), ...rows.filter(row => !changed.has(row.id))];
}

export type PinnedNotice = {
  recordId: string;
  reason: string;
  notificationIds: string[];
};

export function novedadesLabel(count: number) {
  return count === 1 ? '1 novedad' : `${count} novedades`;
}

export function fallbackNoticeReason(note: { section: string; title: string; message: string }) {
  const { section, title, message } = note;
  if (section === 'inventory') {
    if (/archiv/i.test(message) && !/vendido|por canje|volvió/i.test(message)) return 'Archivado';
    if (/volvió al stock/i.test(message) && !/vendido|por canje/i.test(message)) return 'Volvió al stock';
    if (/por canje/i.test(message) && !/vendido/i.test(message)) return 'Nuevo · entró por canje';
    if (/vendido/i.test(message) || /por registrar/i.test(title)) return 'Vendido';
    if (/por canje/i.test(message)) return 'Nuevo · entró por canje';
    return 'Actualizado';
  }
  if (section === 'clients') {
    const debt = message.match(/debe (\$\s?[\d.]+)/i);
    const amount = debt?.[1]?.replace(/\s+/g, ' ');
    if (/nuevo cliente/i.test(title) && amount) return `Nuevo cliente · debe ${amount}`;
    if (/nuevo cliente/i.test(title)) return 'Nuevo cliente';
    if (amount) return `Debe ${amount}`;
    if (/al día/i.test(message)) return 'Quedó al día';
    return title || 'Cliente';
  }
  if (section === 'sales') {
    if (/cancel|anulad/i.test(title)) return 'Anulada';
    if (/actualiz/i.test(title)) return 'Actualizada';
    return 'Venta registrada';
  }
  if (section === 'tradeins') {
    if (/borrador actualizado/i.test(title)) return 'Borrador actualizado';
    if (/borrador/i.test(title)) return 'Borrador';
    if (/cancel|anulad/i.test(title)) return 'Anulada';
    if (/actualiz/i.test(title)) return 'Actualizado';
    return 'Confirmado';
  }
  return title;
}

function storedTargets(value: OperationNotification['targets']) {
  if (!Array.isArray(value)) return [];
  return value.filter((target): target is { recordId: string; reason: string } => {
    return Boolean(target && typeof target.recordId === 'string' && target.recordId.trim() && typeof target.reason === 'string' && target.reason.trim());
  }).map((target) => ({ recordId: target.recordId.trim(), reason: target.reason.trim().replace(/^Cancelad[ao]$/, 'Anulada') }));
}

export function rowsForNotice(note: OperationNotification): Array<{ recordId: string; reason: string; notificationId: string }> {
  const stored = storedTargets(note.targets);
  if (stored.length) return stored.map((target) => ({ ...target, notificationId: note.id }));
  if (!note.recordId?.trim()) return [];
  return [{ recordId: note.recordId.trim(), reason: fallbackNoticeReason(note), notificationId: note.id }];
}

export function mergePinned(current: PinnedNotice[], incoming: OperationNotification[]): PinnedNotice[] {
  const next = current.map((row) => ({ ...row, notificationIds: [...row.notificationIds] }));
  const index = new Map(next.map((row, position) => [row.recordId, position]));
  for (const note of incoming) {
    for (const row of rowsForNotice(note)) {
      const at = index.get(row.recordId);
      if (at == null) {
        index.set(row.recordId, next.length);
        next.push({ recordId: row.recordId, reason: row.reason, notificationIds: [row.notificationId] });
        continue;
      }
      const existing = next[at];
      if (!existing.notificationIds.includes(row.notificationId)) existing.notificationIds.push(row.notificationId);
      existing.reason = mergeNoticeReason(existing.reason, row.reason);
    }
  }
  return next;
}

function noticeParts(reason: string) {
  return reason.split(' · ').map((part) => part.trim()).filter(Boolean);
}

function mergeNoticeReason(current: string, incoming: string) {
  const nextParts = noticeParts(incoming);
  const nextDebt = nextParts.filter((part) => part.startsWith('Debe '));
  if (!nextDebt.length) {
    return noticeParts(current).includes(incoming) ? current : `${current} · ${incoming}`;
  }
  const kept = noticeParts(current).filter((part) => !part.startsWith('Debe '));
  for (const part of nextParts) {
    if (part.startsWith('Debe ') || kept.includes(part)) continue;
    kept.push(part);
  }
  kept.push(nextDebt[nextDebt.length - 1] ?? '');
  return kept.filter(Boolean).join(' · ');
}

/** The list badge uses the client's current debt, so an older notice cannot keep a previous Debe. */
export function reasonWithBalance(reason: string, pendingBalance: number, currency?: string | null) {
  if (!reason) return '';
  const parts = noticeParts(reason).filter((part) => !/^debe\s/i.test(part));
  if (pendingBalance > 0) parts.push(`Debe ${formatMoney(pendingBalance, currency === 'USD' ? 'USD' : 'ARS')}`);
  return parts.join(' · ');
}

export function pinnedCount(rows: PinnedNotice[]) {
  return new Set(rows.flatMap((row) => row.notificationIds)).size;
}
