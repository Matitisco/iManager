type Listener = () => void;

const listeners = new Set<Listener>();
let listening = false;
let offlineSeen = false;
let timer: number | undefined;

function notify() {
  offlineSeen = false;
  listeners.forEach((listener) => listener());
}

function rememberOffline() {
  offlineSeen = true;
}

function browserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function onOnline() {
  notify();
}

function onOffline() {
  rememberOffline();
}

function onVisible() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (browserOffline()) {
    rememberOffline();
    return;
  }
  if (offlineSeen) notify();
}

function poll() {
  if (browserOffline()) {
    rememberOffline();
    return;
  }
  if (offlineSeen) notify();
}

function start() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  if (browserOffline()) offlineSeen = true;
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  // iPhone often updates navigator.onLine without firing `online` while the page stays open.
  timer = window.setInterval(poll, 1000);
}

function stop() {
  if (!listening || listeners.size > 0 || typeof window === 'undefined') return;
  listening = false;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisible);
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

/** Runs when the browser says the connection is back, including iPhone visibility and onLine flips. */
export function subscribeReconnect(listener: Listener) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    stop();
  };
}
