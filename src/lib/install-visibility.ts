import { useSyncExternalStore } from 'react';

/** Local sheets/forms do not all pass through DeskApp's overlay state. */
export function hasInstallBlocker() {
  return [...document.querySelectorAll('form, [role="dialog"], .ov')].some((node) => {
    for (let element: Element | null = node; element; element = element.parentElement) {
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  });
}

export function subscribeInstallBlockers(changed: () => void) {
  const observer = new MutationObserver(changed);
  observer.observe(document.body, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'role'],
  });
  window.addEventListener('resize', changed);
  return () => { observer.disconnect(); window.removeEventListener('resize', changed); };
}

export function useInstallBlocker() {
  return useSyncExternalStore(subscribeInstallBlockers, hasInstallBlocker);
}
