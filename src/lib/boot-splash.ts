export const BOOT_SPLASH_ID = 'boot-splash';
export const BOOT_SPLASH_HIDDEN_EVENT = 'imanager:boot-splash-hidden';
let cancelExit = () => {};

/** Also used before a foreground PWA reload; entry is deliberately instant. */
export function showBootSplash() {
  cancelExit();
  let splash = document.getElementById(BOOT_SPLASH_ID);
  if (!splash) {
    splash = document.createElement('div');
    splash.id = BOOT_SPLASH_ID;
    splash.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('img');
    icon.src = '/icons/icon-192.png';
    icon.alt = '';
    icon.width = 80;
    icon.height = 80;
    splash.append(icon);
    document.body.append(splash);
  }
  delete splash.dataset.leaving;
  splash.style.transition = 'none';
  splash.style.opacity = '1';
  return splash;
}

/** Idempotent: one exit after React has committed the resolved destination. */
export function hideBootSplash() {
  const splash = document.getElementById(BOOT_SPLASH_ID);
  if (!splash || splash.dataset.leaving) return;
  splash.dataset.leaving = 'true';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    splash.remove();
    window.dispatchEvent(new Event(BOOT_SPLASH_HIDDEN_EVENT));
    return;
  }
  splash.style.transition = 'opacity 100ms ease-out';
  splash.style.opacity = '0';
  const remove = () => { splash.remove(); cancelExit(); window.dispatchEvent(new Event(BOOT_SPLASH_HIDDEN_EVENT)); };
  splash.addEventListener('transitionend', remove, { once: true });
  const timer = setTimeout(remove, 120);
  cancelExit = () => { clearTimeout(timer); splash.removeEventListener('transitionend', remove); cancelExit = () => {}; };
}

/** Wait for initial screen placeholders, using their existing accessibility state. */
export function whenBootContentReady(root: ParentNode, ready: () => void) {
  const observer = new MutationObserver(check);
  function check() {
    if (root.querySelector('[aria-busy="true"], .list-skel')) return;
    observer.disconnect();
    ready();
  }
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  check();
  return () => observer.disconnect();
}
