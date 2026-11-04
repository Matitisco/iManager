import { createHash } from 'node:crypto';

// Only public origins belong here, never API keys or provider credentials.
function origin(value, hostname = false) {
  if (!value?.trim()) return undefined;
  const url = new URL(hostname ? `https://${value.trim()}` : value.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid CSP origin');
  return url.origin;
}

export function cspBuildConfig(env = {}) {
  return {
    apiOrigin: origin(env.VITE_API_BASE_URL),
    posthogOrigin: origin(env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'),
    firebaseAuthOrigin: origin(env.VITE_FIREBASE_AUTH_DOMAIN, true),
  };
}

/** @returns {import('vite').Plugin} */
export function cspPlugin(env) {
  return {
    name: 'imanager-csp-config',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'csp-config.json', source: JSON.stringify(cspBuildConfig(env)) });
    },
  };
}

// Hash only the trusted shell on disk, before catalog metadata/request data is added.
// Hashes survive offline PWA caching; per-response nonces would not.
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(([, attributes, body]) => !/\bsrc\s*=/i.test(attributes) && body.trim())
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
}

export function contentSecurityPolicy({ config = {}, scriptHashes = [] } = {}) {
  const posthog = ['https://us.i.posthog.com', 'https://eu.i.posthog.com', 'https://us-assets.i.posthog.com', 'https://eu-assets.i.posthog.com', config.posthogOrigin].filter(Boolean);
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')} https://apis.google.com https://*.googleapis.com https://*.gstatic.com https://accounts.google.com ${posthog.join(' ')} https://sdk.mercadopago.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://images.unsplash.com https://firebasestorage.googleapis.com",
    `connect-src 'self' ${[config.apiOrigin, config.posthogOrigin, config.firebaseAuthOrigin].filter(Boolean).join(' ')} https://*.googleapis.com https://apis.google.com https://*.gstatic.com https://accounts.google.com wss://*.firebaseio.com https://*.firebaseio.com ${posthog.join(' ')} https://dolarapi.com https://mercados.ambito.com`,
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com ${config.firebaseAuthOrigin || ''} https://www.mercadopago.com.ar`,
    "worker-src 'self' blob:", "manifest-src 'self'", "media-src 'self' blob:",
    "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders({ firebaseHelper = false, config, scriptHashes,
  reportOnly = process.env.CSP_REPORT_ONLY === 'true',
  production = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test' } = {}) {
  const base = `base-uri 'self'; object-src 'none'; frame-ancestors ${firebaseHelper ? "'self'" : "'none'"}`;
  const policy = contentSecurityPolicy({ config, scriptHashes });
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': firebaseHelper ? 'SAMEORIGIN' : 'DENY',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=(self)',
    'content-security-policy': firebaseHelper || reportOnly ? base : policy,
    ...(!firebaseHelper && reportOnly ? { 'content-security-policy-report-only': policy } : {}),
    ...(production ? { 'strict-transport-security': 'max-age=31536000' } : {}),
  };
}
