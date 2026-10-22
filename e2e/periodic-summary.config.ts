import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4274';
export default defineConfig({
  testDir: '.', testMatch: 'periodic-summary.spec.ts', workers: 1, timeout: 90_000,
  outputDir: '../test-results/periodic-summary',
  use: { baseURL, browserName: 'chromium', timezoneId: 'America/Argentina/Buenos_Aires' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4274 --strictPort',
    url: baseURL, reuseExistingServer: false,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:3274', DISABLE_HMR: 'true' },
  },
});
