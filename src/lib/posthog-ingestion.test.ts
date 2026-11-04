// Runs the REAL posthog-js SDK (no mock) with our production config and checks what
// would actually reach ingestion. A mocked SDK hid the 2026-11-03 outage: before_send
// removed `token`, the SDK silently dropped every event and zero data reached PostHog.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { securityHeaders } from '../../scripts/security-headers.mjs';

const KEY = 'phc_ingestion_test_key';

beforeEach(async () => {
  vi.resetModules();
  // posthog-js is an externalized dependency: reset its singleton between tests.
  (((await import('posthog-js')).default) as unknown as { __loaded: boolean }).__loaded = false;
  vi.stubEnv('DEV', false);
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('VITEST', '');
  vi.stubEnv('VITE_TEST_AUTH_MODE', '');
  vi.stubEnv('VITE_E2E', '');
  vi.stubEnv('VITE_POSTHOG_DISABLED', '');
  vi.stubEnv('VITE_POSTHOG_KEY', KEY);
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://us.i.posthog.com');
  Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' });
  delete (window as unknown as { posthog?: unknown }).posthog;
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('PostHog ingestion with the real SDK', () => {
  it('initializes with a valid key and host and does not drop $pageview/capture events in before_send', async () => {
    const analytics = await import('./posthog-analytics');
    const { default: posthog } = await import('posthog-js');
    const initSpy = vi.spyOn(posthog, 'init');
    analytics.initAnalytics();
    expect(initSpy).toHaveBeenCalledOnce();
    expect(initSpy.mock.calls[0][0]).toMatch(/^phc_\w+$/);
    expect(initSpy.mock.calls[0][1]!.api_host).toMatch(/^https:\/\/(us|eu)\.i\.posthog\.com$/);
    // The SDK drops (returns undefined) captures where before_send removed required props.
    const result = posthog.capture('sale_created', { quantity: 1 });
    expect(result, 'posthog.capture returned nothing: before_send dropped the event').toBeDefined();
    expect(result!.properties.token).toBe(KEY);
    expect(result!.properties.distinct_id).toBeTruthy();
    expect(result!.properties.$session_id ?? result!.properties.$window_id).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/"(email|password|authorization|refresh_token|access_token)"/);
  });

  it('the pageview fired by initAnalytics survives before_send with token and distinct_id', async () => {
    const { default: posthog } = await import('posthog-js');
    const results: Array<ReturnType<typeof posthog.capture>> = [];
    const realCapture = posthog.capture.bind(posthog);
    vi.spyOn(posthog, 'capture').mockImplementation((...args: Parameters<typeof posthog.capture>) => {
      const result = realCapture(...args); results.push(result); return result;
    });
    (await import('./posthog-analytics')).initAnalytics();
    const pageview = results.find(result => result?.event === '$pageview');
    expect(pageview, 'the initial $pageview was dropped by the SDK (before_send removed a required property)').toBeDefined();
    expect(pageview!.properties.token).toBe(KEY);
    expect(pageview!.properties.distinct_id).toBeTruthy();
  });
});

describe('effective CSP allows PostHog', () => {
  const needed = {
    'script-src': ['https://us-assets.i.posthog.com'],
    'connect-src': ['https://us.i.posthog.com', 'https://us-assets.i.posthog.com'],
  };
  const policies = () => {
    const headers = securityHeaders({ production: true }) as Record<string, string>;
    return ['content-security-policy', 'content-security-policy-report-only'].filter(h => headers[h]).map(h => [h, headers[h]] as const);
  };
  const directive = (policy: string, name: string) => {
    const parts = policy.split(';').map(p => p.trim().split(/\s+/));
    return (parts.find(p => p[0] === name) ?? parts.find(p => p[0] === 'default-src'))?.slice(1);
  };
  it.each(Object.entries(needed))('every CSP (enforced or report-only) that restricts %s allows the PostHog hosts', (name, hosts) => {
    for (const [header, policy] of policies()) {
      const sources = directive(policy, name);
      if (!sources) continue; // directive not restricted by this policy
      for (const host of hosts) expect(sources, `${header} blocks ${host} in ${name}`).toContain(host);
    }
  });
  it('the configured api_host and asset host are covered by connect-src', () => {
    const source = readFileSync(resolve(__dirname, 'posthog-analytics.ts'), 'utf8');
    expect(source).toContain("'https://us.i.posthog.com'");
    const full = policies().map(([, p]) => p).join(';');
    expect(full).toContain('https://us.i.posthog.com');
  });
});
