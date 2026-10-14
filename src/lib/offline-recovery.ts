import { useEffect, useRef } from 'react';
import { subscribeReconnect } from './online';
import { NETWORK_ERROR_MESSAGE } from './user-message';

/**
 * Clears a network banner when the connection returns.
 * #347 only listened inside the catalog effect, so other screens (Más, comisiones,
 * borradores) kept the error string after `online`. iPhone also skips that event
 * while the page stays visible, so the subscription watches visibility and onLine.
 */
export function useOfflineRecovery(message: string | null | undefined, retry: () => void) {
  const retryRef = useRef(retry);
  const messageRef = useRef(message);
  retryRef.current = retry;
  messageRef.current = message;

  useEffect(() => {
    let followUp = 0;
    const retryIfOffline = () => {
      if (messageRef.current !== NETWORK_ERROR_MESSAGE) return;
      retryRef.current();
      window.clearTimeout(followUp);
      // The first fetch after `online` can still fail on iPhone; try once more.
      followUp = window.setTimeout(() => {
        if (messageRef.current === NETWORK_ERROR_MESSAGE && navigator.onLine) retryRef.current();
      }, 800);
    };
    const stop = subscribeReconnect(retryIfOffline);
    return () => {
      stop();
      window.clearTimeout(followUp);
    };
  }, []);
}
