import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { corsOrigins, securityLoggerOptions } from './http-security.js';

it('serializes actual Pino output without request secrets, PII, URL segments or database error contents', async () => {
  let output = '';
  const stream = new Writable({ write(chunk, _encoding, next) { output += chunk.toString(); next(); } });
  const app = Fastify({ logger: { ...securityLoggerOptions, stream } });
  app.get('/invite/:token', async request => {
    const err = Object.assign(new Error('synthetic-private-sql'), { code: 'P2002' });
    request.log.error({ err, error: err, email: 'qa-sec-1@example.com', imei: 'synthetic-private-imei',
      errorMessage: 'synthetic-private-sql', tokenPrefix: 'synthetic-private-prefix',
      provider: { email: 'qa-sec-1@example.com' } }, 'security probe');
    return { ok: true };
  });
  await app.inject({ url: '/invite/synthetic-private-path?password=synthetic-private-query', headers: {
    authorization: 'Bearer synthetic-private-authorization', cookie: 'synthetic-private-cookie',
  } });
  await app.close();
  expect(output).toContain('security probe');
  expect(output).toContain('P2002');
  expect(output).toContain('request completed');
  expect(output).not.toContain('synthetic-private');
  expect(output).not.toContain('qa-sec-1@example.com');
  expect(output).not.toContain('Error: synthetic-private');
});

describe('CORS configuration', () => {
  it('discards wildcard, opaque, credentialed and non-origin entries', () => {
    expect(corsOrigins('*, null, https://user:password@site.example, https://site.example/path, https://allowed.example')).toEqual(['https://allowed.example']);
  });
});
