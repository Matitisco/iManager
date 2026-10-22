import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
const baseURL = 'http://127.0.0.1:4511';
export default defineConfig({
  testDir: '.', testMatch: /451-(shots|reports)\.spec\.ts/, workers: 1, timeout: 60_000,
  outputDir: '/tmp/451-results', reporter: 'list',
  use: { baseURL, browserName: 'chromium', timezoneId: 'America/Argentina/Buenos_Aires', locale: 'es-AR' },
  webServer: { cwd: fileURLToPath(new URL('..', import.meta.url)), command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4511', url: baseURL, reuseExistingServer: false,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:3511', DISABLE_HMR: 'true' } },
});
