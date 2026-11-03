import type { FastifyInstance, FastifyServerOptions } from 'fastify';

// Bearer authentication has no application cookies. Never reflect an arbitrary Origin.
export function corsOrigins(configured?: string): string[] {
  const defaults = ['https://app.imanager.com.ar', process.env.FRONTEND_URL];
  return (configured?.trim() ? configured.split(',') : defaults)
    .flatMap(value => {
      try {
        const source = value?.trim();
        if (!source) return [];
        const url = new URL(source);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === source && !url.username && !url.password ? [source] : [];
      } catch { return []; }
    });
}

const privateFields = ['Authorization', 'access_token', 'refresh_token', 'set-cookie', 'authorization', 'cookie', 'password', 'email', 'imei', 'token', 'tokenPrefix', 'accessToken', 'refreshToken', 'errorMessage'];

/** Deliberately omit error messages/stacks: Prisma/provider errors can embed input data. */
function safeError(value: unknown) {
  const error = value as { name?: unknown; code?: unknown; statusCode?: unknown } | null;
  return {
    message: '[REDACTED]',
    stack: '',
    type: typeof error?.name === 'string' && /^[A-Za-z]+Error$/.test(error.name) ? error.name : 'Error',
    ...(typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,70}$/.test(error.code) ? { code: error.code } : {}),
    ...(typeof error?.statusCode === 'number' ? { statusCode: error.statusCode } : {}),
  };
}

export const securityLoggerOptions: Exclude<FastifyServerOptions['logger'], boolean | undefined> = {
  redact: {
    paths: [...privateFields.flatMap(key => [key, `*.${key}`, `*.*.${key}`]), 'req.headers', 'req.body', 'res.headers', 'body', 'headers'],
    censor: '[REDACTED]',
  },
  serializers: {
    // Request URLs include invitation tokens and arbitrary PII in query/path segments.
    req: request => ({ method: request.method }),
    res: reply => ({ statusCode: reply.statusCode }),
    err: safeError,
    error: safeError,
  },
};

export function registerHttpSecurity(app: FastifyInstance, { production = false } = {}) {
  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    });
    if (production) reply.header('strict-transport-security', 'max-age=31536000');
    if (request.url.startsWith('/api') || request.url.startsWith('/admin')) reply.header('cache-control', 'no-store');
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Not found' }));
}
