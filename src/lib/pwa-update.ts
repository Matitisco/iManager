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
// scriptURL is still /sw.js). No sessionStorage flag that could suppress updates.
export function watchControllerUpdates(worker: ServiceWorkerContainer, onUpdate: () => void) {
  let controller = worker.controller;
  const changed = () => {
    const next = worker.controller;
    if (next && next !== controller) {
      const previous = controller;
      controller = next;
      if (previous) onUpdate();
    }
  };
  worker.addEventListener('controllerchange', changed);
  return () => worker.removeEventListener('controllerchange', changed);
}
