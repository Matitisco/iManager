import { markOffline, markOnline } from '../lib/online';
import { NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE, toUserMessage } from '../lib/user-message';

const DEFAULT_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    markOnline();
    return response;
  } catch (error) {
    if (!timedOut && error instanceof TypeError) markOffline();
    if (timedOut) throw new DOMException(TIMEOUT_ERROR_MESSAGE, 'TimeoutError');
    // Keep the browser error name so invitation retries still recognize it.
    const message = error instanceof TypeError ? NETWORK_ERROR_MESSAGE : toUserMessage(error);
    const friendlyError = new Error(message, { cause: error });
    if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') friendlyError.name = error.name;
    throw friendlyError;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}
