import { track } from './track.js';
import type { AppUserContext } from '../../types/auth.js';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
export function arDayKey(now = new Date()): string { return formatter.format(now); }
const days = new Map<string, string>();
export function trackActiveDay(member: AppUserContext, header: unknown, now = new Date()) {
  const day = arDayKey(now);
  if (process.env.ANALYTICS_DISABLED === '1') return;
  const previous = days.get(member.userId);
  days.delete(member.userId); days.set(member.userId, day);
  if (days.size > 5000) days.delete(days.keys().next().value!);
  if (previous === day) return;
  const parts = typeof header === 'string' ? header.split(';').map(s => s.trim()) : [];
  const device = parts[0] === 'phone' || parts[0] === 'desktop' ? parts[0] : undefined;
  void track({ name: 'active_day', storeId: member.storeId, userId: member.userId, dedupeKey: `day:${member.userId}:${day}`, props: { role: member.role, ...(device ? { device } : {}), pwa: parts.includes('pwa=1') } });
}
