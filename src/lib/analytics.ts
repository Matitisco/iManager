import type { AuthUserLike } from '../types/auth-user';
import { apiRequest } from '../services/api-client';

export type ClientEventName = 'onboarding_name_viewed' | 'onboarding_stock_viewed' | 'stock_method_chosen' | 'stock_import_finished' | 'stock_import_abandoned' | 'first_steps_opened' | 'first_steps_step_clicked' | 'invite_shared';
type Props = Record<string, string | number | boolean>;
type Pending = { name: ClientEventName; props?: Props; at: string };
let user: AuthUserLike | null = null;
let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let enabledInTests = false;
let listening = false;
let generation = 0;
export function enableAnalyticsInTests(enabled: boolean) { enabledInTests = enabled; }
export function setAnalyticsUser(next: AuthUserLike | null) {
  if (user?.uid !== next?.uid) {
    queue = []; generation++;
    clearTimeout(timer); timer = undefined;
  }
  user = next;
}
export function rowBucket(count: number): string { return count <= 1 ? '1' : count <= 10 ? '2-10' : count <= 50 ? '11-50' : '51+'; }
function schedule() {
  if (!timer) timer = setTimeout(() => { timer = undefined; void flushAnalytics(); }, 3000);
}
export function track(name: ClientEventName, props?: Props): void {
  try {
    if (!user || (import.meta.env.MODE === 'test' && !enabledInTests)) return;
    if (!listening && typeof window !== 'undefined') {
      listening = true;
      window.addEventListener('pagehide', () => { void flushAnalytics(); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flushAnalytics(); });
    }
    // Bound memory while offline. Only allow scalar props; the server owns the whitelist.
    if (queue.length >= 100) return;
    queue.push({ name, ...(props ? { props } : {}), at: new Date().toISOString() });
    if (queue.length >= 10) void flushAnalytics();
    else schedule();
  } catch { /* Analytics must not interrupt interaction. */ }
}
export async function flushAnalytics(): Promise<void> {
  try {
    clearTimeout(timer); timer = undefined;
    if (!user) { queue = []; return; }
    const batch = queue.splice(0, 20);
    if (!batch.length) return;
    const current = user; const currentGeneration = generation;
    const send = () => apiRequest(current, '/api/events', { method: 'POST', body: { events: batch }, keepalive: true, fallback: 'No se pudieron registrar las métricas.' });
    try { await send(); }
    catch { if (user?.uid === current.uid && currentGeneration === generation) await send().catch(() => undefined); }
    if (queue.length) schedule();
  } catch { /* Best effort, including token acquisition. */ }
}
