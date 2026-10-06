import { useEffect, useState } from 'react';
import { PHONE_QUERY } from './logic';

export function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(PHONE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(PHONE_QUERY);
    const sync = () => setIsPhone(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isPhone;
}
