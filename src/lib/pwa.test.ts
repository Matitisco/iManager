import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type * as PWA from './pwa';
let pwa: typeof PWA;
beforeEach(async () => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T12:00:00Z')); pwa = await import('./pwa'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const promptEvent = (outcome: 'accepted' | 'dismissed', prompt = vi.fn(async () => {})) => {
  pwa.initializeInstallEvents();
  window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt, userChoice: Promise.resolve({ outcome }) }));
  return prompt;
};
it('snoozes for exactly seven days and persists across module reloads', async () => {
  pwa.snoozeInstall();
  const until = Date.now() + 604800000;
  expect(pwa.getInstallPreference()).toEqual({ version: 2, dismissedForever: false, snoozedUntil: until });
  vi.resetModules(); pwa = await import('./pwa');
  vi.setSystemTime(until - 1); expect(pwa.installDismissed()).toBe(true);
  vi.setSystemTime(until); expect(pwa.installDismissed()).toBe(false);
});
it('permanent dismissal clears expiry and cannot be reset by snooze', () => {
  pwa.snoozeInstall(); pwa.dismissInstall(); pwa.snoozeInstall();
  expect(pwa.getInstallPreference()).toEqual({ version: 2, dismissedForever: true, snoozedUntil: null });
});
for (const key of ['imanager:install-dismissed', 'imanager:install-dismissed:ios', 'imanager:install-dismissed:android']) {
  it(`migrates ${key} conservatively`, () => {
    localStorage.setItem(key, 'yes');
    expect(pwa.installDismissedForever()).toBe(true);
    expect(JSON.parse(localStorage.getItem(pwa.INSTALL_PREFERENCE_KEY)!)).toEqual({ version: 2, dismissedForever: true, snoozedUntil: null });
    expect(localStorage.getItem(key)).toBeNull();
  });
}
it('does not remove legacy flags if migration cannot persist', () => {
  localStorage.setItem(pwa.INSTALL_DISMISSED_KEY, 'yes');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
  expect(pwa.installDismissedForever()).toBe(true);
  expect(localStorage.getItem(pwa.INSTALL_DISMISSED_KEY)).toBe('yes');
});
it('retains choices in memory when reads and writes are blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked'); });
  pwa.snoozeInstall(); expect(pwa.installDismissed()).toBe(true);
  vi.advanceTimersByTime(pwa.INSTALL_SNOOZE_MS); expect(pwa.installDismissed()).toBe(false);
  pwa.dismissInstall(); expect(pwa.installDismissedForever()).toBe(true);
});
for (const raw of ['{oops', 'null', '{"version":2,"dismissedForever":false,"snoozedUntil":"tomorrow"}', '{"version":1}']) {
  it(`recovers corrupt preference ${raw}`, () => {
    localStorage.setItem(pwa.INSTALL_PREFERENCE_KEY, raw);
    expect(pwa.installDismissed()).toBe(false);
    pwa.snoozeInstall(); expect(pwa.installDismissed()).toBe(true);
  });
}
it('notifies all consumers on updates, expiry and storage changes, with cleanup', () => {
  const first = vi.fn(); const second = vi.fn();
  const stop = pwa.subscribeInstall(first); const stopSecond = pwa.subscribeInstall(second);
  pwa.snoozeInstall(); expect(first).toHaveBeenCalled(); expect(second).toHaveBeenCalled();
  first.mockClear(); vi.advanceTimersByTime(pwa.INSTALL_SNOOZE_MS);
  expect(first).toHaveBeenCalledOnce(); expect(pwa.installDismissed()).toBe(false);
  localStorage.setItem(pwa.INSTALL_PREFERENCE_KEY, JSON.stringify({ version: 2, dismissedForever: true, snoozedUntil: null }));
  window.dispatchEvent(new StorageEvent('storage', { key: pwa.INSTALL_PREFERENCE_KEY }));
  expect(pwa.installDismissedForever()).toBe(true);
  localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null }));
  expect(pwa.installDismissedForever()).toBe(false);
  stop(); stopSecond(); first.mockClear(); pwa.dismissInstall(); expect(first).not.toHaveBeenCalled();
});
it('recalculates expiry when a tab returns after sleep', () => {
  const changed = vi.fn(); const stop = pwa.subscribeInstall(changed); pwa.snoozeInstall();
  vi.setSystemTime(Date.now() + pwa.INSTALL_SNOOZE_MS); changed.mockClear();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(changed).toHaveBeenCalled(); expect(pwa.installDismissed()).toBe(false); stop();
});
it('returns explicit outcomes, snoozes native dismissal, and consumes once', async () => {
  const prompt = promptEvent('dismissed');
  expect(await pwa.requestInstall()).toBe('dismissed');
  expect(await pwa.requestInstall()).toBe('unavailable');
  expect(prompt).toHaveBeenCalledOnce(); expect(pwa.installDismissedForever()).toBe(false); expect(pwa.installDismissed()).toBe(true);
});
it('acceptance does not claim installation or persist a dismissal', async () => {
  promptEvent('accepted'); expect(await pwa.requestInstall()).toBe('accepted');
  expect(pwa.installRequestAccepted()).toBe(true); expect(pwa.isAppInstalled()).toBe(false); expect(pwa.installDismissed()).toBe(false);
  window.dispatchEvent(new Event('appinstalled')); expect(pwa.isAppInstalled()).toBe(true);
});
it('blocks double consumption while pending and consumes failed events', async () => {
  let finish!: () => void;
  const prompt = promptEvent('accepted', vi.fn(() => new Promise<void>(resolve => { finish = resolve; })));
  const pending = pwa.requestInstall(); expect(await pwa.requestInstall()).toBe('unavailable'); finish(); await pending;
  expect(prompt).toHaveBeenCalledOnce();
  promptEvent('accepted', vi.fn(async () => { throw Error('unavailable'); }));
  await expect(pwa.requestInstall()).rejects.toThrow('unavailable');
  expect(pwa.getInstallPrompt()).toBeNull();
});
