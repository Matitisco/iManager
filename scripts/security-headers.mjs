// A full CSP is staged in report-only until Firebase redirect/replay integrations
// have been verified in staging. The enforced policy already blocks embedding,
// base-tag injection and plugin objects, without changing legitimate scripts.
export function securityHeaders({ firebaseHelper = false, production = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test' } = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': firebaseHelper ? 'SAMEORIGIN' : 'DENY',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=(self)',
    'content-security-policy': `base-uri 'self'; object-src 'none'; frame-ancestors ${firebaseHelper ? "'self'" : "'none'"}`,
    ...(!firebaseHelper ? { 'content-security-policy-report-only': [
      "default-src 'self'",
      "script-src 'self' https://apis.google.com https://www.gstatic.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://sdk.mercadopago.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://images.unsplash.com https://firebasestorage.googleapis.com",
      "connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://us.i.posthog.com https://eu.i.posthog.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://dolarapi.com https://mercados.ambito.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.mercadopago.com.ar",
      "worker-src 'self' blob:", "manifest-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    ].join('; ') } : {}),
    ...(production ? { 'strict-transport-security': 'max-age=31536000' } : {}),
  };
}
