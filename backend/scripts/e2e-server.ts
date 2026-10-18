import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';

if (env.NODE_ENV !== 'test' || !env.ENABLE_TEST_AUTH_BYPASS) {
  throw new Error('The E2E server requires test mode and test authentication.');
}

// Parallel browser contexts and repeats share one loopback IP. Production and
// integration tests keep the default limit of 60 anonymous reads per minute.
const app = buildApp({ publicCatalogReadLimit: 1000 });
app.addHook('onError', async (request, _reply, error) => {
  // CI responses deliberately hide internal errors. Log only the route and
  // error class/code, never headers, credentials, payloads or provider messages.
  if (!error.statusCode || error.statusCode >= 500) {
    console.error(`[E2E API] ${request.method} ${request.routeOptions.url}: ${error.name} ${error.code ?? 'unknown'}`);
  }
});
await app.listen({ port: env.PORT, host: '127.0.0.1' });
