import { apiRequest } from '../services/api-client';
import type { AuthUserLike } from '../types/auth-user';
import { imeiPassesLuhn } from './imei';
import { imeiSpecs } from './imei-tac';

let user: AuthUserLike | null = null;
const reported = new Set<string>();
export function setTacReportUser(next: AuthUserLike | null) { user = next; }

/** Only a TAC may cross this boundary, never an IMEI or unit details. */
export function reportUnknownTac(tac: string): void {
  try {
    if (tac.length !== 8 || !/^\d{8}$/.test(tac) || !user || reported.has(tac)) return;
    reported.add(tac);
    void apiRequest(user, '/api/imei-tac-misses', { method: 'POST', body: { tac }, keepalive: true, fallback: '' }).catch(() => {});
  } catch {}
}

/** Used only by existing autofill flows; general scanning stays free of reporting. */
export function autofillImeiSpecs(imei: string) {
  const specs = imeiSpecs(imei);
  if (!specs && imei.length === 15 && imeiPassesLuhn(imei)) reportUnknownTac(imei.slice(0, 8));
  return specs;
}
