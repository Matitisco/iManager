import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({ default: {
  init: vi.fn(), capture: vi.fn(), identify: vi.fn(), register: vi.fn(), reset: vi.fn(),
} }));

const pushState = window.history.pushState;
const replaceState = window.history.replaceState;
let listeners: Array<[string, EventListener]> = [];

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('DEV', false);
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('VITEST', '');
  vi.stubEnv('VITE_TEST_AUTH_MODE', '');
  vi.stubEnv('VITE_E2E', '');
  vi.stubEnv('VITE_POSTHOG_DISABLED', '');
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
  replaceState.call(history, null, '', '/');
  listeners = [];
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((name, listener, options) => {
    if (name === 'hashchange' || name === 'popstate') listeners.push([name, listener as EventListener]);
    add(name, listener, options);
  });
});

afterEach(() => {
  for (const [name, listener] of listeners) window.removeEventListener(name, listener);
  window.history.pushState = pushState;
  window.history.replaceState = replaceState;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PostHog runtime guard', () => {
  it.each([
    ['DEV', true], ['MODE', 'test'], ['VITEST', 'true'], ['VITE_TEST_AUTH_MODE', 'e2e'],
    ['VITE_E2E', 'true'], ['VITE_E2E', '1'], ['VITE_POSTHOG_DISABLED', 'true'],
    ['VITE_POSTHOG_KEY', ''], ['VITE_POSTHOG_KEY', '  '],
  ] as const)('makes every operation a no-op for %s=%s', async (key, value) => {
    vi.stubEnv(key, value);
    const analytics = await import('./posthog-analytics');
    expect(() => {
      analytics.initAnalytics(); analytics.capture('sale_created');
      analytics.identify('u', 's', 'OWNER'); analytics.reset();
      analytics.observeInventory(0); analytics.deviceAdded();
    }).not.toThrow();
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.reset).not.toHaveBeenCalled();
  });
  it('does not initialize under webdriver', async () => {
    vi.mocked(vi.spyOn(navigator, 'webdriver', 'get')).mockReturnValue(true);
    (await import('./posthog-analytics')).initAnalytics();
    expect(posthog.init).not.toHaveBeenCalled();
  });
  it('uses the supplied public defaults when env overrides are absent', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', undefined); vi.stubEnv('VITE_POSTHOG_HOST', undefined);
    (await import('./posthog-analytics')).initAnalytics();
    expect(posthog.init).toHaveBeenCalledWith('phc_yusUYUHJ7W28DSuYBW6v6n7te8VbzkZZcXnracPnXaeo', expect.objectContaining({ api_host: 'https://us.i.posthog.com' }));
  });
});

describe('PostHog collection and privacy', () => {
  it('initializes once, masks replay and disables UI, console and network collection', async () => {
    const { initAnalytics } = await import('./posthog-analytics');
    initAnalytics(); initAnalytics();
    expect(posthog.init).toHaveBeenCalledOnce();
    const config = vi.mocked(posthog.init).mock.calls[0][1]!;
    expect(config).toMatchObject({ autocapture: true, mask_all_text: true, mask_all_element_attributes: true,
      disable_surveys: true, disable_conversations: true, enable_recording_console_log: false,
      session_recording: { maskAllInputs: true, maskTextSelector: '*', maskAllElementAttributes: true, recordHeaders: false, recordBody: false } });
    expect(config.session_recording!.maskCapturedNetworkRequestFn!({ name: 'https://test/api?token=private', duration: 0, startTime: 0, entryType: 'resource' })).toBeNull();
  });
  it('captures SPA sections once per transition without query values, tokens or record IDs', async () => {
    const { initAnalytics } = await import('./posthog-analytics');
    initAnalytics();
    history.pushState(null, '', '/#/atencion/clientes?search=private@example.com');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    history.replaceState(null, '', '/#/cuenta/configuracion/equipo/private-member?email=private');
    history.replaceState(null, '', '/invite/secret-token?oobCode=secret');
    expect(vi.mocked(posthog.capture).mock.calls.map(call => call[1]?.$current_url)).toEqual([
      `${location.origin}/`, `${location.origin}/#/atencion/clientes`,
      `${location.origin}/#/cuenta/configuracion`, `${location.origin}/invite`,
    ]);
    expect(JSON.stringify(vi.mocked(posthog.capture).mock.calls)).not.toMatch(/private|secret/);
  });
  it('removes SDK URL and attribution properties before sending', async () => {
    const { initAnalytics } = await import('./posthog-analytics'); initAnalytics();
    history.replaceState(null, '', '/invite/secret?email=private');
    const beforeSend = vi.mocked(posthog.init).mock.calls[0][1]!.before_send;
    if (typeof beforeSend !== 'function') throw new Error('Missing privacy hook');
    const event = beforeSend({ uuid: 'test-uuid', event: '$autocapture', properties: { $current_url: location.href,
      $initial_current_url: location.href, $referrer: 'https://test/?token=secret', $pathname: '/invite/secret', utm_source: 'private', $set_once: { $initial_current_url: location.href, role: 'OWNER' } } });
    expect(event!.properties).toEqual({ $current_url: `${location.origin}/invite`, $pathname: '/invite', $set_once: { role: 'OWNER' } });
  });
  it('identifies only internal IDs and role, deduplicates rerenders and resets between users', async () => {
    const analytics = await import('./posthog-analytics'); analytics.initAnalytics();
    analytics.identify('u', 's', 'OWNER'); analytics.identify('u', 's', 'OWNER');
    expect(posthog.identify).toHaveBeenCalledExactlyOnceWith('u', { store_id: 's', role: 'OWNER' });
    analytics.identify('u', 'other-store', 'STAFF');
    expect(posthog.register).toHaveBeenLastCalledWith({ store_id: 'other-store', role: 'STAFF' });
    analytics.identify('other-user', null, null);
    expect(posthog.reset).toHaveBeenCalledOnce();
    analytics.reset(); expect(posthog.reset).toHaveBeenCalledTimes(2);
  });
  it('filters extra props and normalizes counts at runtime', async () => {
    const analytics = await import('./posthog-analytics'); analytics.initAnalytics(); vi.mocked(posthog.capture).mockClear();
    const props = { rows: 2, email: 'private@example.com', amount: 100 };
    analytics.capture('excel_import_succeeded', props);
    analytics.capture('excel_import_failed', { rows: NaN });
    analytics.capture('onboarding_step_completed', { step: 'store' });
    expect(posthog.capture).toHaveBeenNthCalledWith(1, 'excel_import_succeeded', { rows: 2 });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, 'excel_import_failed', { rows: 0 });
    expect(posthog.capture).toHaveBeenNthCalledWith(3, 'onboarding_step_completed', { step: 'store' });
    expect(JSON.stringify(vi.mocked(posthog.capture).mock.calls)).not.toContain('private');
  });
  it('emits first-device only after a known empty read and deduplicates per store/browser', async () => {
    const a = await import('./posthog-analytics'); a.initAnalytics(); a.identify('u', 's', 'OWNER');
    vi.mocked(posthog.capture).mockClear(); a.deviceAdded(); expect(posthog.capture).not.toHaveBeenCalled();
    a.observeInventory(0); a.deviceAdded(); a.deviceAdded(); a.observeInventory(0); a.deviceAdded();
    expect(posthog.capture).toHaveBeenCalledExactlyOnceWith('first_device_added', undefined);
    a.identify('u', 's2', 'OWNER'); localStorage.setItem('imanager:posthog:first-device:s2', '1');
    a.observeInventory(0); a.deviceAdded(); expect(posthog.capture).toHaveBeenCalledOnce();
  });
  it('contains SDK and storage exceptions', async () => {
    const a = await import('./posthog-analytics');
    vi.mocked(posthog.init).mockImplementationOnce(() => { throw new Error('SDK unavailable'); });
    expect(a.initAnalytics).not.toThrow(); a.capture('sale_created'); expect(posthog.capture).not.toHaveBeenCalled();
    a.initAnalytics();
    const fail = () => { throw new Error('SDK unavailable'); };
    vi.mocked(posthog.capture).mockImplementation(fail); vi.mocked(posthog.identify).mockImplementation(fail); vi.mocked(posthog.reset).mockImplementation(fail);
    expect(() => { a.capture('sale_created'); a.identify('u', 's', 'OWNER'); a.reset(); }).not.toThrow();
  });
});
