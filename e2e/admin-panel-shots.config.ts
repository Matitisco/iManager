import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
const baseURL = process.env.PLAYWRIGHT_APP_BASE_URL || 'http://127.0.0.1:4194';
export default defineConfig({
  testDir: '.', testMatch: 'admin-panel-shots.spec.ts', timeout: 60000, workers: 1,
  use: { baseURL, browserName: 'chromium', timezoneId: 'America/Argentina/Buenos_Aires' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${new URL(baseURL).port}`,
    url: baseURL, reuseExistingServer: false,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:3194', DISABLE_HMR: 'true' },
  },
});
