import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Standalone browser regression: all business APIs are mocked, no DB/global setup.
export default defineConfig({
  testDir: '.',
  testMatch: 'posthog.spec.ts',
  workers: 1,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4598' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'npx vite --host 127.0.0.1 --port 4598 --strictPort',
    url: 'http://127.0.0.1:4598',
    reuseExistingServer: false,
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:3198',
      VITE_TEST_AUTH_MODE: 'e2e',
      VITE_E2E_TEST_PASSWORD: 'test123456',
      DISABLE_HMR: 'true',
      CHOKIDAR_USEPOLLING: 'true',
      CHOKIDAR_INTERVAL: '1000',
    },
  },
});
