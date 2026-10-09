import { useEffect, useState } from 'react';

export const PHONE_QUERY = '(max-width: 760px)';

export function keyboardInsetPx(layoutHeight: number, visualHeight: number, offsetTop: number) {
  if (!Number.isFinite(layoutHeight) || !Number.isFinite(visualHeight)) return 0;
  return Math.max(0, Math.round(layoutHeight - visualHeight - (Number.isFinite(offsetTop) ? offsetTop : 0)));
}

export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return phone;
}

export function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => setInset(keyboardInsetPx(window.innerHeight, viewport.height, viewport.offsetTop));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);

  return inset;
}
