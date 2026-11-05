import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Deliberately independent of the main config: no backend, global setup or DB.
const app = 'http://127.0.0.1:4819';

export default defineConfig({
  testDir: '.',
  testMatch: 'selector-siempre.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: '../test-results/selector-siempre',
  use: {
    baseURL: app,
    serviceWorkers: 'block',
    timezoneId: 'America/Argentina/Buenos_Aires',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/opt/google/chrome/chrome', args: ['--no-sandbox'] },
  },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4819 --strictPort',
    url: app,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    env: { VITE_API_BASE_URL: app, VITE_TEST_AUTH_MODE: 'e2e', DISABLE_HMR: 'true' },
  },
});
