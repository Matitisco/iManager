import { getBackendBaseUrl } from './backend-session';
import { fetchWithTimeout } from './fetch-with-timeout';
import type { AuthUserLike } from '../types/auth-user';

function getBaseUrlOrThrow() {
  const url = getBackendBaseUrl();
  if (!url) throw new Error('Backend no configurado');
  return url.replace(/\/+$/, '');
}

async function authHeaders(user: AuthUserLike) {
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Error en la petición');
  }
}

export async function send2faCode(user: AuthUserLike): Promise<void> {
  const res = await fetchWithTimeout(`${getBaseUrlOrThrow()}/api/security/2fa/send`, {
    method: 'POST',
    headers: await authHeaders(user),
  });
  await assertOk(res);
}

export async function verify2faCode(user: AuthUserLike, code: string): Promise<void> {
  const res = await fetchWithTimeout(`${getBaseUrlOrThrow()}/api/security/2fa/verify`, {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify({ code }),
  });
  await assertOk(res);
}

export async function disable2fa(user: AuthUserLike): Promise<void> {
  const res = await fetchWithTimeout(`${getBaseUrlOrThrow()}/api/security/2fa`, {
    method: 'DELETE',
    headers: await authHeaders(user),
  });
  await assertOk(res);
}
