import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4198';
export default defineConfig({
  testDir: '.',
  testMatch: '308-shots.spec.ts',
  workers: 1,
  timeout: 90_000,
  outputDir: '/tmp/308-shot-results',
  use: { baseURL, browserName: 'chromium', timezoneId: 'America/Argentina/Buenos_Aires' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4198',
    url: baseURL,
    reuseExistingServer: false,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:3198', DISABLE_HMR: 'true' },
  },
});
