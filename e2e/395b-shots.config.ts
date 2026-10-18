import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// Capturas manuales con fixtures: npx playwright test --config e2e/395b-shots.config.ts
const baseURL = 'http://127.0.0.1:4195';
export default defineConfig({
  testDir: '.', testMatch: '395b-shots.spec.ts', workers: 1, timeout: 120_000,
  outputDir: '/tmp/395b-shot-results',
  use: { baseURL, browserName: 'chromium', timezoneId: 'America/Argentina/Buenos_Aires' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4195',
    url: baseURL, reuseExistingServer: false,
    env: { VITE_TEST_AUTH_MODE: 'e2e', VITE_API_BASE_URL: 'http://127.0.0.1:3195', DISABLE_HMR: 'true' },
  },
});
