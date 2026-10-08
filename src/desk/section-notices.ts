import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OperationNotification } from '../services/operations-api';
import type { NoticeSection } from './unread-count';

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

export function useSectionNotices(section: NoticeSection) {
  const { operationNotifications, markNotificationRead } = useAppContext();
  const notes = operationNotifications ?? [];
  const [pinned, setPinned] = useState<PinnedNotice[]>([]);
  const pinnedIds = useRef(new Set<string>());
  const marked = useRef(new Set<string>());
  const unreadKey = notes.filter((note) => note.section === section && !note.readAt).map((note) => note.id).join('|');

  useEffect(() => {
    const incoming = notes.filter((note) => note.section === section && !note.readAt && !pinnedIds.current.has(note.id));
    if (!incoming.length) return;
    for (const note of incoming) pinnedIds.current.add(note.id);
    setPinned((current) => mergePinned(current, incoming));
  }, [unreadKey, notes, section]);

  const markVisible = useCallback((recordIds: string[]) => {
    if (typeof markNotificationRead !== 'function') return;
    const visible = new Set(recordIds);
    const ids = [...new Set(pinned.flatMap((row) => (visible.has(row.recordId) ? row.notificationIds : [])))]
      .filter((id) => !marked.current.has(id));
    if (!ids.length) return;
    for (const id of ids) marked.current.add(id);
    for (const id of ids) {
      void markNotificationRead(id).catch(() => { marked.current.delete(id); });
    }
  }, [markNotificationRead, pinned]);

  const byRecord = useMemo(() => new Map(pinned.map((row) => [row.recordId, row.reason])), [pinned]);
  return {
    count: pinnedCount(pinned),
    reasonFor: (id: string) => byRecord.get(id) ?? '',
    markVisible,
  };
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
    if (/cancel/i.test(title)) return 'Cancelada';
    if (/actualiz/i.test(title)) return 'Actualizada';
    return 'Venta registrada';
  }
  if (section === 'tradeins') {
    if (/borrador actualizado/i.test(title)) return 'Borrador actualizado';
    if (/borrador/i.test(title)) return 'Borrador';
    if (/cancel/i.test(title)) return 'Cancelado';
    if (/actualiz/i.test(title)) return 'Actualizado';
    return 'Confirmado';
  }
  return title;
}

function storedTargets(value: OperationNotification['targets']) {
  if (!Array.isArray(value)) return [];
  return value.filter((target): target is { recordId: string; reason: string } => {
    return Boolean(target && typeof target.recordId === 'string' && target.recordId.trim() && typeof target.reason === 'string' && target.reason.trim());
  }).map((target) => ({ recordId: target.recordId.trim(), reason: target.reason.trim() }));
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
      if (!existing.reason.split(' · ').includes(row.reason)) existing.reason = `${existing.reason} · ${row.reason}`;
    }
  }
  return next;
}

export function pinnedCount(rows: PinnedNotice[]) {
  return new Set(rows.flatMap((row) => row.notificationIds)).size;
}

export function isNoticeSection(section: string): section is NoticeSection {
  return section === 'inventory' || section === 'sales' || section === 'tradeins' || section === 'clients';
}
