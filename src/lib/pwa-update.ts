// Conservative guard shared by automatic and explicit update requests. Keeping a
// clean modal open also blocks reload: custom controls can hold React-only drafts.
export function watchUpdateSafety(onSafe: () => void, root: HTMLElement = document.body) {
  const edited = new Set<Element>();
  let timer: number | undefined;
  const isSafe = () => {
    for (const node of edited) if (!node.isConnected) edited.delete(node);
    return edited.size === 0 && !root.querySelector('form, [role="dialog"], .ov, [aria-busy="true"], [contenteditable="true"], [data-pwa-update-block]');
  };
  const check = () => {
    window.clearTimeout(timer);
    // Let React finish commits/unmounts before inspecting drafts and overlays.
    timer = window.setTimeout(() => { if (isSafe()) onSafe(); }, 100);
  };
  const edit = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]')) edited.add(target);
    check();
  };
  root.addEventListener('input', edit, true);
  root.addEventListener('change', edit, true);
  const observer = new MutationObserver(check);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy', 'data-pwa-update-block'] });
  return {
    isSafe,
    dispose: () => {
      window.clearTimeout(timer);
      observer.disconnect();
      root.removeEventListener('input', edit, true);
      root.removeEventListener('change', edit, true);
    },
  };
}

// The first claim is installation, not an update. If registration starts with an
// existing controller, any subsequent controller is a new release (even if its
// scriptURL is still /sw.js). Some browsers fire controllerchange before
// `.controller` points at the new worker, so the read is repeated.
export function watchControllerUpdates(worker: ServiceWorkerContainer, onUpdate: () => void) {
  let controller = worker.controller;
  let timer = 0;
  const apply = () => {
    const next = worker.controller;
    if (next && next !== controller) {
      const previous = controller;
      controller = next;
      if (previous) onUpdate();
    }
  };
  const changed = () => {
    apply();
    queueMicrotask(apply);
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 0);
  };
  worker.addEventListener('controllerchange', changed);
  return () => {
    window.clearTimeout(timer);
    worker.removeEventListener('controllerchange', changed);
  };
}

export const VERSION_URL = '/version.json';
export const VERSION_CHECK_MS = 3 * 60 * 1000;

export function appBuildId() {
  return typeof __IMANAGER_BUILD_ID__ === 'string' && __IMANAGER_BUILD_ID__ ? __IMANAGER_BUILD_ID__ : 'dev';
}

export async function readRemoteBuildId(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(VERSION_URL, { cache: 'no-store', headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = await response.json() as { buildId?: unknown };
    return typeof body.buildId === 'string' && body.buildId ? body.buildId : null;
  } catch {
    return null;
  }
}

type VersionSource = Pick<ServiceWorkerContainer, 'getRegistration'>;

// Compares /version.json (no-store) with the id baked into this bundle.
// Checks when the tab is shown, when it is focused, every few minutes, and
// when the browser finds a new worker — controllerchange is not enough on iOS.
export function watchVersionUpdates(
  localId: string,
  onUpdate: (buildId: string) => void,
  options: { intervalMs?: number; fetchImpl?: typeof fetch; worker?: VersionSource | null } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const intervalMs = options.intervalMs ?? VERSION_CHECK_MS;
  let stopped = false;
  let generation = 0;
  let reported = '';
  const check = () => {
    if (stopped) return;
    const token = ++generation;
    void readRemoteBuildId(fetchImpl).then((remote) => {
      if (stopped || token !== generation || !remote || remote === localId || remote === reported) return;
      reported = remote;
      onUpdate(remote);
    });
  };
  const whenVisible = () => {
    if (document.visibilityState !== 'hidden') check();
  };
  const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', check);
  const timer = window.setInterval(whenVisible, intervalMs);
  let unbindRegistration = () => {};
  if (options.worker) {
    void options.worker.getRegistration().then((registration) => {
      if (stopped || !registration) return;
      const onFound = () => check();
      registration.addEventListener('updatefound', onFound);
      unbindRegistration = () => registration.removeEventListener('updatefound', onFound);
    }).catch(() => {});
  }
  whenVisible();
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', check);
    unbindRegistration();
  };
}
