import { useCallback, useEffect, useState } from 'react';
import { clearAuthActionUrl, readAuthAction, syncAuthActionUrl, type AuthActionLink } from './auth-action-url';

export function useAuthActionLink() {
  const [link, setLink] = useState<AuthActionLink | null>(() => readAuthAction(window.location));

  useEffect(() => {
    const sync = () => setLink(syncAuthActionUrl());
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const dismiss = useCallback(() => {
    clearAuthActionUrl();
    setLink(null);
  }, []);

  return { link, dismiss };
}
