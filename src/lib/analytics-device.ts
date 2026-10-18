/** Only coarse viewport and standalone state leave the browser; never user-agent. */
export function analyticsDeviceHeader() {
  try {
    const device = window.matchMedia('(max-width: 760px)').matches ? 'phone' : 'desktop';
    const pwa = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return `${device}${pwa ? ';pwa=1' : ''}`;
  } catch { return 'desktop'; }
}
