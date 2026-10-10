export const AUTH_ACTION_PATH = 'restablecer';

const AUTH_MODES = new Set([
  'resetPassword',
  'verifyEmail',
  'recoverEmail',
  'verifyAndChangeEmail',
  'signIn',
]);

const AUTH_QUERY_KEYS = ['mode', 'oobCode', 'apiKey', 'continueUrl', 'lang'] as const;

export interface AuthActionLink {
  mode: string;
  oobCode: string;
  apiKey: string | null;
  continueUrl: string | null;
  lang: string | null;
}

export interface AuthActionLocation {
  pathname: string;
  search: string;
  hash: string;
}

function first(hashParams: URLSearchParams, searchParams: URLSearchParams, key: string): string {
  return hashParams.get(key) || searchParams.get(key) || '';
}

function parseHash(hash: string): { path: string; params: URLSearchParams } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = raw.indexOf('?');
  const pathPart = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const path = pathPart.replace(/^\/+/, '').split('/')[0] ?? '';
  return {
    path,
    params: new URLSearchParams(queryAt === -1 ? '' : raw.slice(queryAt + 1)),
  };
}

/**
 * Firebase appends `?mode=…&oobCode=…` to the custom action URL.
 * With a hash route that query lives inside `location.hash`, not `location.search`.
 * Links configured without the hash put the same params in `location.search`.
 */
export function readAuthAction(location: Pick<AuthActionLocation, 'search' | 'hash'>): AuthActionLink | null {
  const searchParams = new URLSearchParams(location.search);
  const { path, params: hashParams } = parseHash(location.hash);
  const mode = first(hashParams, searchParams, 'mode');
  const oobCode = first(hashParams, searchParams, 'oobCode');
  const onRoute = path === AUTH_ACTION_PATH;
  if (!onRoute && !AUTH_MODES.has(mode)) return null;
  return {
    mode,
    oobCode,
    apiKey: first(hashParams, searchParams, 'apiKey') || null,
    continueUrl: first(hashParams, searchParams, 'continueUrl') || null,
    lang: first(hashParams, searchParams, 'lang') || null,
  };
}

export function formatAuthActionHash(link: AuthActionLink): string {
  const params = new URLSearchParams();
  if (link.mode) params.set('mode', link.mode);
  if (link.oobCode) params.set('oobCode', link.oobCode);
  if (link.apiKey) params.set('apiKey', link.apiKey);
  if (link.continueUrl) params.set('continueUrl', link.continueUrl);
  if (link.lang) params.set('lang', link.lang);
  const query = params.toString();
  return query ? `#/${AUTH_ACTION_PATH}?${query}` : `#/${AUTH_ACTION_PATH}`;
}

export function stripAuthQuery(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of AUTH_QUERY_KEYS) params.delete(key);
  const next = params.toString();
  return next ? `?${next}` : '';
}

export function authActionHref(location: AuthActionLocation): string | null {
  const link = readAuthAction(location);
  if (!link) return null;
  const pathname = location.pathname || '/';
  return `${pathname}${stripAuthQuery(location.search)}${formatAuthActionHash(link)}`;
}

function currentHref(location: AuthActionLocation): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function syncAuthActionUrl(): AuthActionLink | null {
  const link = readAuthAction(window.location);
  if (!link) return null;
  const href = authActionHref(window.location);
  if (href && href !== currentHref(window.location)) {
    window.history.replaceState(null, '', href);
  }
  return readAuthAction(window.location) ?? link;
}

export function clearAuthActionUrl() {
  const pathname = window.location.pathname || '/';
  window.history.replaceState(null, '', `${pathname}${stripAuthQuery(window.location.search)}`);
}
